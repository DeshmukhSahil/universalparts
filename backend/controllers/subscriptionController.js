// controllers/subscriptionController.js
require('dotenv').config();
const { razorpay, getPlanAmountPaise } = require("../utils/razorpay");
const User = require("../models/User");
const crypto = require("crypto");

function sendDevDebug(res, err, defaultStatus = 500) {
  const status = (err && err.statusCode) || defaultStatus;
  const razorErr = err && (err.error || err);
  const debug = process.env.NODE_ENV === "production" ? undefined : { razorErr, stack: err && err.stack };
  return res.status(status).json({ message: "Could not create order", debug });
}

// Create Razorpay order for a plan
exports.createOrder = async (req, res) => {
  try {
    console.log("createOrder called; user:", req.user && req.user._id);
    console.log("REQ BODY:", req.body);

    const { plan } = req.body;
    if (!["monthly", "six_months", "yearly"].includes(plan)) {
      return res.status(400).json({ message: "Invalid plan" });
    }

    const amount = getPlanAmountPaise(plan);
    // Validate amount is an integer > 0
    if (!Number.isInteger(amount) || amount <= 0) {
      console.error("Invalid amount from getPlanAmountPaise:", amount);
      return res.status(500).json({ message: "Server misconfigured: invalid plan amount" });
    }

    const receipt = `rcpt_${crypto.randomBytes(6).toString('hex')}`;
    const options = {
      amount,
      currency: "INR",
      receipt,
      payment_capture: 1,
      notes: { plan, userId: req.user ? String(req.user._id) : undefined },
    };

    console.log("Creating Razorpay order with options:", options);

    const order = await razorpay.orders.create(options);

    console.log("Razorpay order created:", { id: order.id, amount: order.amount, currency: order.currency });

    // attach order id to user's subscription draft
    if (req.user) {
      const user = await User.findById(req.user._id);
      if (user) {
        user.subscription = user.subscription || {};
        user.subscription.plan = plan;
        user.subscription.razorpayOrderId = order.id;
        user.subscription.status = "inactive";
        await user.save();
      } else {
        console.warn("createOrder: req.user present but User.findById returned null", req.user._id);
      }
    }

    return res.json({ orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (err) {
    // Log as much useful info as possible
    console.error("createOrder ERROR statusCode:", err && err.statusCode);
    console.error("createOrder ERROR message:", err && err.message);
    console.error("createOrder ERROR body/error:", err && (err.error || err));
    console.error("createOrder FULL err:", err && err.stack);

    return sendDevDebug(res, err);
  }
};

// verify signature helper (unchanged, but log any mis-match)
function verifySignature(orderId, paymentId, signature) {
  const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
  hmac.update(orderId + "|" + paymentId);
  const expected = hmac.digest("hex");
  const ok = expected === signature;
  if (!ok) console.warn("verifySignature mismatch. expected:", expected, "received:", signature);
  return ok;
}

exports.verifyPaymentSignature = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment fields" });
    }

    const ok = verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!ok) return res.status(400).json({ message: "Invalid signature" });

    const user = await User.findOne({ "subscription.razorpayOrderId": razorpay_order_id });
    if (user) {
      user.subscription.razorpayPaymentId = razorpay_payment_id;
      user.subscription.status = "active";
      user.subscription.startDate = new Date();
      const plan = user.subscription.plan;
      let end = new Date();
      if (plan === "monthly") end.setMonth(end.getMonth() + 1);
      if (plan === "six_months") end.setMonth(end.getMonth() + 6);
      if (plan === "yearly") end.setFullYear(end.getFullYear() + 1);
      user.subscription.endDate = end;
      await user.save();
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Verification failed" });
  }
};

// webhook to handle payment success (use with router.post('/webhook', express.raw({ type: '*/*' }), sub.webhookHandler))
exports.webhookHandler = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.warn("RAZORPAY_WEBHOOK_SECRET not set");
      return res.status(500).json({ message: "Webhook secret not configured" });
    }

    // req.body may be a Buffer (because express.raw used) or already-parsed JSON.
    // Compute canonical raw body string for signature verification:
    const rawBody = (req.body && Buffer.isBuffer(req.body))
      ? req.body.toString("utf8")
      : (typeof req.body === "string" ? req.body : JSON.stringify(req.body));

    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      console.warn("Webhook missing x-razorpay-signature header");
      return res.status(400).json({ message: "Missing signature header" });
    }

    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (signature !== expected) {
      console.warn("Webhook signature mismatch", { expected, received: signature });
      return res.status(400).json({ message: "Invalid signature" });
    }

    // Parse payload safely (if req.body was raw string)
    let payload;
    if (req.body && Buffer.isBuffer(req.body)) {
      payload = JSON.parse(rawBody);
    } else {
      payload = req.body;
    }

    // quick log
    console.log("Webhook received event:", payload && payload.event);

    // Handle payment captured event
    if (payload && payload.event === "payment.captured") {
      const payment = payload.payload && payload.payload.payment && payload.payload.payment.entity;
      if (payment) {
        const orderId = payment.order_id || payment.orderId || null;
        const paymentId = payment.id;
        console.log("Webhook payment.captured:", { orderId, paymentId, amount: payment.amount });

        if (orderId) {
          try {
            // find user with this order and activate subscription
            const user = await User.findOne({ "subscription.razorpayOrderId": orderId });
            if (user) {
              user.subscription = user.subscription || {};
              user.subscription.razorpayPaymentId = paymentId;
              user.subscription.status = "active";
              user.subscription.startDate = new Date();

              const plan = user.subscription.plan;
              const start = new Date();
              let end = new Date(start);
              if (plan === "monthly") end.setMonth(end.getMonth() + 1);
              if (plan === "six_months") end.setMonth(end.getMonth() + 6);
              if (plan === "yearly") end.setFullYear(end.getFullYear() + 1);
              user.subscription.endDate = end;

              await user.save();
              console.log("Webhook: subscription activated for user:", user._id);
            } else {
              console.warn("Webhook: no user found for orderId", orderId);
            }
          } catch (dbErr) {
            console.error("Webhook DB update error:", dbErr);
            // still respond 200 to webhook to avoid retries if you prefer; otherwise return 500.
            // We'll return 200 but log the failure so you can investigate.
          }
        } else {
          console.warn("Webhook payment.captured but missing order_id in payload.payment.entity");
        }
      } else {
        console.warn("Webhook payment.captured but payload.payment.entity missing");
      }
    }

    // respond quickly and politely
    return res.json({ ok: true });
  } catch (err) {
    console.error("Webhook handler error", err);
    // if anything went wrong parsing or verifying, return 500 to let razorpay retry (or 400 if signature mismatch above)
    return res.status(500).json({ message: "Webhook error" });
  }
};
