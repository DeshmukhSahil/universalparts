// src/pages/ForgotPassword.jsx
import React, { useState } from "react";
import api from "../api/axios";
import styles from "./LoginForm.module.css"; // reuse same styles

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/forgot-password", { email });
      setMessage(res?.data?.message || "Password reset link sent if account exists.");
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <h2 className={styles.title}>Reset your password</h2>
        <p className={styles.subtitle}>
          Enter your email address and we’ll send you a reset link.
        </p>

        {message && <div className={styles.success}>{message}</div>}
        {error && <div className={styles.error}>{error}</div>}

        <input
          className={styles.input}
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button type="submit" className={styles.button} disabled={loading}>
          {loading ? "Sending…" : "Send Reset Link"}
        </button>
      </form>
    </div>
  );
}
