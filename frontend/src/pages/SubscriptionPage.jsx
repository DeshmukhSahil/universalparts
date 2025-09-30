import React, { useContext } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import styles from "./SubscriptionPage.module.css";

const API = process.env.REACT_APP_API_BASE || "";
const RAZORPAY_KEY = process.env.REACT_APP_RAZORPAY_KEY_ID;

const PLANS = [
  { key: "monthly", title: "Monthly", price: 299, desc: "Perfect to try it out" },
  { key: "six_months", title: "6 Months", price: 1599, desc: "Best for consistent users" },
  { key: "yearly", title: "Yearly", price: 2999, desc: "Great savings for regular users" },
];

export default function SubscriptionPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const subscribe = async (planKey) => {
    try {
      if (!user) {
        alert("You must be logged in to subscribe");
        navigate("/login");
        return;
      }

      console.log("Subscribe clicked:", planKey, "userId:", user?._id);
      console.log("API base:", API, "Razorpay key present:", !!RAZORPAY_KEY);
      console.log("document.cookie:", document.cookie || "(no cookies)");
      console.log("Attempting create-order POST to:", `${API}/api/subscription/create-order`);

      const res = await axios.post(
        `${API}/api/subscription/create-order`,
        { plan: planKey },
        { withCredentials: true, timeout: 15000 }
      );

      console.log("create-order response status:", res.status, "data:", res.data);
      const { orderId, amount, currency } = res.data;

      const options = {
        key: RAZORPAY_KEY,
        amount,
        currency,
        name: "Universal Parts",
        description: `${planKey} subscription`,
        order_id: orderId,
        handler: async function (response) {
          try {
            console.log("Razorpay handler response:", response);
            const verifyRes = await axios.post(
              `${API}/api/subscription/verify-payment`,
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
              { withCredentials: true }
            );
            console.log("verify-payment response:", verifyRes.status, verifyRes.data);
            alert("Payment successful — subscription should be active");
          } catch (err) {
            console.error("Payment verification failed - err.response:", err?.response?.data || err);
            alert("Payment verification failed. See console.");
          }
        },
        prefill: {
          email: user?.email || "",
          contact: user?.phone || "",
        },
        method: {
          upi: true,      // ✅ enable UPI
          card: true,     // keep cards enabled
          netbanking: true,
          wallet: true
        },
        theme: { color: "#0ea5a4" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      // Very detailed client-side error logging
      console.error("Could not create order - err.response:", err?.response);
      console.error("Could not create order - err.response.data:", err?.response?.data);
      console.error("Could not create order - err.response.status:", err?.response?.status);
      console.error("Could not create order - err.request:", err?.request);
      console.error("Could not create order - err.message:", err?.message);

      // Show server message to user if present (helpful when server sends descriptive msg)
      const serverMsg = err?.response?.data?.message || err?.response?.data || err.message || "Could not create order";
      alert(`Could not create order: ${serverMsg}`);
    }
  };

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Choose Your Plan</h2>
      <p className={styles.subheading}>Simple pricing. No hidden fees. Cancel anytime.</p>

      <div className={styles.plansGrid}>
        {PLANS.map((p) => (
          <div key={p.key} className={styles.planCard}>
            <h3 className={styles.planTitle}>{p.title}</h3>
            <p className={styles.planPrice}>₹{p.price}</p>
            <p className={styles.planDesc}>{p.desc}</p>
            <button className={styles.subscribeBtn} onClick={() => subscribe(p.key)}>
              Subscribe
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
