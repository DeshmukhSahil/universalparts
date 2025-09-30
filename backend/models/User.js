// models/User.js
const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  plan: { type: String, enum: ["monthly", "six_months", "yearly"], default: null },
  status: { type: String, enum: ["inactive", "active", "cancelled"], default: "inactive" },
  startDate: Date,
  endDate: Date,
  razorpayOrderId: String,
  razorpayPaymentId: String
}, { _id: false });

const userSchema = new mongoose.Schema({
  firstName: { type: String, trim: true, required: false },
  lastName: { type: String, trim: true, required: false },
  email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  password: { type: String }, // hashed
  phone: { type: String, unique: true, sparse: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },

  // verification flags
  isEmailVerified: { type: Boolean, default: false },
  isPhoneVerified: { type: Boolean, default: false },

  // email OTP: keep only hashed OTP + expiry + counters
  emailOTPHash: { type: String },        // HMAC-SHA256 of OTP
  emailOTPExpiresAt: { type: Date },
  emailOTPAttempts: { type: Number, default: 0 }, // failed verify attempts
  emailOTPLastSentAt: { type: Date },
  emailOTPResendCount: { type: Number, default: 0 },
  emailOTPLockedUntil: { type: Date }, // temporary lockout if too many attempts

  // subscription
  subscription: { type: subscriptionSchema, default: () => ({}) },

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
