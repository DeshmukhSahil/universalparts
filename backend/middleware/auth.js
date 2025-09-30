// middleware/auth.js
require('dotenv').config();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  try {
    const tokenFromCookie = req.cookies && req.cookies.token;
    const authHeader = req.headers.authorization || "";
    const token = tokenFromCookie || (authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null);
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("-password -emailOTP -emailOTPExpiresAt");
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = { authMiddleware };
