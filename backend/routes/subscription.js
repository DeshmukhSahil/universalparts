// routes/subscription.js
const express = require("express");
const router = express.Router();

// DON'T destructure here if you expect undefined; require whole module so we can inspect
const sub = require("../controllers/subscriptionController");
const authModule = require("../middleware/auth");

// If middleware exports named field, grab it:
const authMiddleware = authModule && authModule.authMiddleware;

// Diagnostic log
console.log("subscription route handlers:",
  {
    authMiddleware: typeof authMiddleware,
    createOrder: typeof (sub && sub.createOrder),
    verifyPaymentSignature: typeof (sub && sub.verifyPaymentSignature),
    webhookHandler: typeof (sub && sub.webhookHandler),
  }
);

// Fail fast with helpful message if any handler missing
if (typeof authMiddleware !== "function") {
  throw new TypeError("authMiddleware is not a function — check middleware/auth.js export or circular requires");
}
if (typeof sub?.createOrder !== "function") {
  throw new TypeError("createOrder is not a function — check controllers/subscriptionController.js export or circular requires");
}
if (typeof sub?.verifyPaymentSignature !== "function") {
  throw new TypeError("verifyPaymentSignature is not a function — check controllers/subscriptionController.js export");
}
if (typeof sub?.webhookHandler !== "function") {
  throw new TypeError("webhookHandler is not a function — check controllers/subscriptionController.js export");
}

// Routes
router.post("/create-order", authMiddleware, express.json(), sub.createOrder);
router.post("/verify-payment", authMiddleware, express.json(), sub.verifyPaymentSignature);

// webhook needs raw body for signature validation
router.post("/webhook", express.raw({ type: "*/*" }), sub.webhookHandler);

module.exports = router;
