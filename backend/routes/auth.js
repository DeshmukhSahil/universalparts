// routes/auth.js
const express = require("express");
const router = express.Router();
const auth = require("../controllers/authController");
const { authMiddleware } = require("../middleware/auth");

// registration & email OTP flows
router.post("/register", auth.register);
router.post("/login", auth.login);
router.post("/send-email-otp", auth.sendEmailOTP);
router.post("/verify-email-otp", auth.verifyEmailOTP);
router.post("/logout", auth.logout);
router.post("/google", auth.googleOAuth);

router.post("/forgot-password", auth.forgotPassword);
router.post("/reset-password/:token", auth.resetPassword);

// phone verification (client should obtain firebaseIdToken after phone auth)
router.post("/verify-phone", auth.verifyPhoneToken);

router.post('/register-admin', auth.registerAdmin);

// protected
router.get("/me", authMiddleware, auth.me);

module.exports = router;
