// utils/razorpay.js
require('dotenv').config();
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const PLANS = {
  monthly: { amountINR: 299 },      // 299 INR
  six_months: { amountINR: 1599 },  // example
  yearly: { amountINR: 2999 },      // example
};

function getPlanAmountPaise(planKey) {
  const plan = PLANS[planKey];
  if (!plan) throw new Error("Invalid plan");
  return plan.amountINR * 100; // paise
}

module.exports = { razorpay, PLANS, getPlanAmountPaise };
