// src/components/RegisterForm.jsx
import React, { useState, useContext } from "react";
import axios from "axios";
import styles from "./RegisterForm.module.css";
import { AuthContext } from "../contexts/AuthContext";

const API = process.env.REACT_APP_API_BASE; // e.g. https://universalparts.onrender.com or https://universalparts.onrender.com/api
// NOTE: Ensure your backend routes are reachable at `${API}/auth/...`
// If your REACT_APP_API_BASE already contains /api, using `${API}/auth/register` is still correct.

export default function RegisterForm() {
  const { setToken } = useContext(AuthContext);

  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  const [step, setStep] = useState("form"); // 'form' | 'otp' | 'done'
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleRegister = async (e) => {
    e && e.preventDefault();
    setMessage(null);

    // basic client-side validation
    if (!form.email || !form.password || !form.firstName) {
      setMessage({ type: "error", text: "Please enter name, email and password." });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/api/auth/register`, form);
      // server may return previewUrl for ethereal in dev
      if (res.data.previewUrl) setPreviewUrl(res.data.previewUrl);
      setStep("otp");
      setMessage({ type: "success", text: "Registered. Enter the OTP sent to your email." });
    } catch (err) {
      console.error("register error:", err);
      const text = err?.response?.data?.message || err?.message || "Registration failed";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await axios.post(`${API}/api/auth/send-email-otp`, { email: form.email });
      if (res.data.previewUrl) setPreviewUrl(res.data.previewUrl);
      setMessage({ type: "success", text: "OTP resent. Check your email." });
    } catch (err) {
      console.error("resend otp error:", err);
      setMessage({ type: "error", text: err?.response?.data?.message || "Failed to resend OTP" });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp || otp.trim().length === 0) {
      setMessage({ type: "error", text: "Enter the OTP." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await axios.post(`${API}/api/auth/verify-email-otp`, { email: form.email, otp: otp.trim() });
      if (res.data.token) {
        setToken(res.data.token);
        setStep("done");
        setMessage({ type: "success", text: "Email verified — you are now logged in." });
      } else {
        setMessage({ type: "error", text: "Verification failed." });
      }
    } catch (err) {
      console.error("verify otp error:", err);
      setMessage({ type: "error", text: err?.response?.data?.message || "OTP verification failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card} role="region" aria-labelledby="register-title">
        <h2 id="register-title" className={styles.title}>Create your account</h2>
        <p className={styles.lead}>Fast access to parts, compatibility and subscriptions.</p>

        {message && (
          <div
            className={
              message.type === "error" ? styles.alertError : styles.alertSuccess
            }
            role="status"
          >
            {message.text}
          </div>
        )}

        {step === "form" && (
          <form className={styles.form} onSubmit={handleRegister}>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>First name</label>
                <input
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Jane"
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Last name</label>
                <input
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className={styles.input}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <div className={styles.passwordWrap}>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Create a strong password"
                  required
                />
                <button
                  type="button"
                  className={styles.pwToggle}
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.primary} type="submit" disabled={loading}>
                {loading ? "Creating…" : "Create account"}
              </button>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => {
                  setForm({ email: "", password: "", firstName: "", lastName: "" });
                  setMessage(null);
                }}
              >
                Clear
              </button>
            </div>

            <div className={styles.small}>
              By creating an account you agree to our <a href="#" onClick={(e)=>e.preventDefault()}>Terms</a>.
            </div>
          </form>
        )}

        {step === "otp" && (
          <div className={styles.otpWrap}>
            <p className={styles.otpLead}>
              We emailed a one-time code to <strong>{form.email}</strong>. Enter it below to verify your account.
            </p>

            <div className={styles.field}>
              <label className={styles.label}>OTP Code</label>
              <input
                name="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className={styles.input}
                placeholder="123456"
                inputMode="numeric"
              />
            </div>

            <div className={styles.actions}>
              <button className={styles.primary} onClick={verifyOtp} disabled={loading}>
                {loading ? "Verifying…" : "Verify & sign in"}
              </button>

              <button type="button" className={styles.ghost} onClick={resendOtp} disabled={loading}>
                Resend code
              </button>
            </div>

            {previewUrl && (
              <div className={styles.preview}>
                <small>Dev email preview:</small>{" "}
                <a href={previewUrl} target="_blank" rel="noreferrer">Open OTP email</a>
              </div>
            )}
          </div>
        )}

        {step === "done" && (
          <div className={styles.done}>
            <h3>Welcome 👋</h3>
            <p>Your account has been created and verified.</p>
          </div>
        )}
      </div>
    </div>
  );
}
