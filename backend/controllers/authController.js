// controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { sendEmail } = require("../utils/mailer");
const admin = require("firebase-admin");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const SALT_ROUNDS = 10;

// OTP configuration - tweak as needed
const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;        // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;       // 60 seconds between sends
const OTP_MAX_RESENDS_PER_HOUR = 3;             // max resends per rolling hour
const OTP_MAX_VERIFY_ATTEMPTS = 5;              // max wrong tries before lock
const OTP_LOCK_MS = 15 * 60 * 1000;             // 15 minutes lock after too many attempts

// OTP HMAC secret - set OTP_SECRET in env for rotation possibility
const OTP_SECRET = process.env.OTP_SECRET || process.env.JWT_SECRET || "default_otp_secret";

// Cookie and JWT settings
const COOKIE_NAME = process.env.JWT_COOKIE_NAME || "token";
// If you set JWT_EXPIRES_MS in env, it will be used; otherwise default to 7 days
const COOKIE_MAX_AGE = process.env.JWT_EXPIRES_MS ? parseInt(process.env.JWT_EXPIRES_MS, 10) : 7 * 24 * 60 * 60 * 1000;
const cookieOptions = {
  httpOnly: true,
  secure: false,                       // false on localhost (dev), true in production (HTTPS)
  sameSite: "lax",    // "none" in prod if cross-site, "lax" is safe in dev
  maxAge: COOKIE_MAX_AGE,
  path: "/"
};

// Helper: sign JWT
function signToken(user) {
  return jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || "7d",
  });
}

// Helper: create random 6-digit OTP
function generateOTP() {
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(6, "0");
}

// Helper: hash OTP with HMAC-SHA256
function hashOTP(otp) {
  return crypto.createHmac("sha256", OTP_SECRET).update(String(otp)).digest("hex");
}

// Constant-time comparison
function safeEqual(a, b) {
  try {
    const A = Buffer.from(a || "", "hex");
    const B = Buffer.from(b || "", "hex");
    if (A.length !== B.length) return false;
    return crypto.timingSafeEqual(A, B);
  } catch (e) {
    return false;
  }
}

// Reusable: send OTP email and update user counters
async function sendOTPEmailToUser(user) {
  const now = Date.now();

  // reset resend count if last sent > 1 hour ago
  if (user.emailOTPLastSentAt && (now - new Date(user.emailOTPLastSentAt).getTime() > 60 * 60 * 1000)) {
    user.emailOTPResendCount = 0;
  }

  // cooldown check
  if (user.emailOTPLastSentAt && (now - new Date(user.emailOTPLastSentAt).getTime() < OTP_RESEND_COOLDOWN_MS)) {
    const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - new Date(user.emailOTPLastSentAt).getTime())) / 1000);
    const err = new Error(`Please wait ${wait}s before requesting a new code.`);
    err.code = "RATE_LIMIT";
    throw err;
  }

  if (user.emailOTPResendCount >= OTP_MAX_RESENDS_PER_HOUR) {
    const err = new Error("Maximum resend attempts reached. Please try again later.");
    err.code = "RESEND_LIMIT";
    throw err;
  }

  const otp = generateOTP();
  const otpHash = hashOTP(otp);

  user.emailOTPHash = otpHash;
  user.emailOTPExpiresAt = new Date(Date.now() + EMAIL_OTP_TTL_MS);
  user.emailOTPAttempts = 0;
  user.emailOTPLastSentAt = new Date();
  user.emailOTPResendCount = (user.emailOTPResendCount || 0) + 1;
  user.emailOTPLockedUntil = undefined;

  await user.save();

  const sent = await sendEmail({
    to: user.email,
    subject: "Your verification code",
    text: `Your verification code is ${otp}. It expires in 10 minutes.`,
    html: `<p>Your verification code is <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
  });

  return { previewUrl: sent.previewUrl || null };
}

// --- Controller exports ---
// controllers/authController.js (register)
exports.register = async (req, res) => {
  try {
    let { email, password, phone, firstName, lastName } = req.body;

    // normalize inputs
    email = typeof email === "string" ? email.trim().toLowerCase() : undefined;
    phone = typeof phone === "string" ? phone.trim() : undefined;

    if (!email && !phone) {
      return res.status(400).json({ message: "Email or phone required" });
    }

    // build $or only with provided values (avoid undefined in query)
    const orClause = [];
    if (email) orClause.push({ email });
    if (phone) orClause.push({ phone });

    // defensive: if somehow orClause empty, treat as bad request
    if (orClause.length === 0) {
      return res.status(400).json({ message: "No valid email or phone provided" });
    }

    // look for existing user with either email or phone
    const existing = await User.findOne({ $or: orClause });

    if (existing) {
      // helpful debug info (don't leak sensitive info to client)
      console.warn("Register attempted but user exists:", {
        emailAttempt: email,
        phoneAttempt: phone,
        existingId: existing._id.toString(),
      });
      return res.status(409).json({ message: "User already exists" });
    }

    const hashed = password ? await bcrypt.hash(password, SALT_ROUNDS) : undefined;
    const user = new User({ email, password: hashed, phone, firstName, lastName });
    await user.save();

    let previewUrl = null;
    if (email) {
      try {
        const out = await sendOTPEmailToUser(user);
        previewUrl = out.previewUrl;
      } catch (err) {
        console.error("OTP send during register failed:", err.message || err);
      }
    }

    return res.status(201).json({ message: "User created", previewUrl });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


exports.login = async (req, res) => {
  try {
    const { email, password, phone } = req.body;
    let user;
    if (email) user = await User.findOne({ email });
    else if (phone) user = await User.findOne({ phone });
    else return res.status(400).json({ message: "Provide email or phone" });

    if (!user) return res.status(404).json({ message: "User not found" });

    if (password) {
      const ok = await bcrypt.compare(password, user.password || "");
      if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    } else {
      return res.status(400).json({ message: "Password required for email login" });
    }

    const token = signToken(user);

    // set httpOnly cookie instead of returning token in body
    res.cookie(COOKIE_NAME, token, cookieOptions);

    // return user info only
    return res.json({ user: { id: user._id, email: user.email, phone: user.phone, role: user.role }});
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.sendEmailOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "No user for that email" });

    // check lock
    if (user.emailOTPLockedUntil && new Date() < user.emailOTPLockedUntil) {
      const wait = Math.ceil((user.emailOTPLockedUntil - new Date()) / 1000);
      return res.status(429).json({ message: `Too many failed attempts. Try again in ${wait}s.` });
    }

    try {
      const result = await sendOTPEmailToUser(user);
      return res.json({ message: "OTP sent", previewUrl: result.previewUrl || null });
    } catch (err) {
      if (err.code === "RATE_LIMIT") return res.status(429).json({ message: err.message });
      if (err.code === "RESEND_LIMIT") return res.status(429).json({ message: err.message });
      throw err;
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // check locked
    if (user.emailOTPLockedUntil && new Date() < user.emailOTPLockedUntil) {
      const wait = Math.ceil((user.emailOTPLockedUntil - new Date()) / 1000);
      return res.status(429).json({ message: `Too many failed attempts. Try again in ${wait}s.` });
    }

    if (!user.emailOTPHash || !user.emailOTPExpiresAt || new Date() > user.emailOTPExpiresAt) {
      return res.status(400).json({ message: "OTP expired or not sent" });
    }

    const providedHash = hashOTP(String(otp));
    const ok = safeEqual(providedHash, user.emailOTPHash);

    if (!ok) {
      user.emailOTPAttempts = (user.emailOTPAttempts || 0) + 1;
      // lock if too many attempts
      if (user.emailOTPAttempts >= OTP_MAX_VERIFY_ATTEMPTS) {
        user.emailOTPLockedUntil = new Date(Date.now() + OTP_LOCK_MS);
      }
      await user.save();
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // success
    user.isEmailVerified = true;
    user.emailOTPHash = undefined;
    user.emailOTPExpiresAt = undefined;
    user.emailOTPAttempts = 0;
    user.emailOTPResendCount = 0;
    user.emailOTPLastSentAt = undefined;
    user.emailOTPLockedUntil = undefined;
    await user.save();

    const token = signToken(user);

    // set cookie before responding
    res.cookie(COOKIE_NAME, token, cookieOptions);

    return res.json({ message: "Email verified", user: { id: user._id, email: user.email, phone: user.phone, role: user.role } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.registerAdmin= async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // normalize email
    const normalizedEmail = String(email).trim().toLowerCase();

    // check existing
    const exists = await User.findOne({ email: normalizedEmail }).exec();
    if (exists) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // hash password
    const hash = await bcrypt.hash(password, 10);

    const user = new User({
      firstName: firstName || '',
      lastName: lastName || '',
      email: normalizedEmail,
      password: hash,
      role: 'admin',
      isEmailVerified: true,   // consider true so admin can sign-in immediately
      isPhoneVerified: false,
      // add other defaults as your User model requires
    });

    if (phone) user.phone = phone;

    await user.save();

    // prepare safe output (remove sensitive fields)
    const out = user.toObject ? user.toObject() : JSON.parse(JSON.stringify(user));
    delete out.password;
    // remove sensitive OTP fields if present
    delete out.emailOTP;
    delete out.emailOTPExpiresAt;

    // OPTIONAL: auto-login by issuing JWT cookie — uncomment if desired
    /*
    const token = jwt.sign({ sub: out._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    */

    return res.status(201).json({ user: out });
  } catch (err) {
    console.error('registerAdmin error', err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
}

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Don’t reveal that email doesn’t exist
      return res.json({ message: "If an account exists, a reset link was sent." });
    }

    // generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: "Password Reset",
      text: `Click here to reset your password: ${resetUrl}`,
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password.</p>`,
    });

    res.json({ message: "If an account exists, a reset link was sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  try {
    const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password = password; // your User model should hash this
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ message: "Password reset successful, you can now log in." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};



exports.googleOAuth = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: "Missing credential" });

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    // payload contains email, email_verified, given_name, family_name, sub (google user id), picture, etc.
    const email = payload.email;
    const emailVerified = payload.email_verified;
    const firstName = payload.given_name;
    const lastName = payload.family_name;
    const googleId = payload.sub;

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        email,
        firstName,
        lastName,
        isEmailVerified: !!emailVerified,
        googleId,
      });
    } else {
      // keep the existing user; optionally attach googleId
      user.googleId = user.googleId || googleId;
      if (emailVerified) user.isEmailVerified = true;
    }
    await user.save();

    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, cookieOptions);
    return res.json({ user: { id: user._id, email: user.email, phone: user.phone, role: user.role } });
  } catch (err) {
    console.error("Google OAuth error:", err);
    return res.status(400).json({ message: "Invalid Google token" });
  }
};


// Firebase phone verification unchanged (keep previous implementation)
exports.verifyPhoneToken = async (req, res) => {
  try {
    const { firebaseIdToken, phone } = req.body;
    if (!firebaseIdToken) return res.status(400).json({ message: "Token required" });

    if (!admin.apps.length) {
      const keyJson = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({ credential: admin.credential.cert(keyJson) });
    }

    const decoded = await admin.auth().verifyIdToken(firebaseIdToken);
    const phoneNumber = decoded.phone_number || phone;
    if (!phoneNumber) return res.status(400).json({ message: "Phone not present in token" });

    let user = await User.findOne({ phone: phoneNumber });
    if (!user) {
      user = new User({ phone: phoneNumber, isPhoneVerified: true });
    } else {
      user.isPhoneVerified = true;
    }
    await user.save();

    const token = signToken(user);

    // set cookie
    res.cookie(COOKIE_NAME, token, cookieOptions);

    return res.json({ message: "Phone verified", user: { id: user._id, phone: user.phone, role: user.role } });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: "Invalid firebase token" });
  }
};

exports.logout = async (req, res) => {
  try {
    // clear cookie (ensure same name / path / sameSite / secure as set)
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/"
    });
    return res.json({ message: "Logged out" });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.me = async (req, res) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  return res.json({ user: req.user });
};
