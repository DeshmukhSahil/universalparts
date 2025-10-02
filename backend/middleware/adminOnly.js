// middleware/adminOnly.js
const adminOnly = (req, res, next) => {
  // authMiddleware should already have set req.user
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden — admin only" });
  }

  next();
};

module.exports = { adminOnly };
