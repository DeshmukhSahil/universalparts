// src/pages/LoginForm.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios"; // your configured axios instance (see note below)
import { AuthContext } from "../contexts/AuthContext";
import styles from "./LoginForm.module.css";

export default function LoginForm() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);

  // NOTE: Make sure your axios instance sets withCredentials: true so cookies are included.
  // e.g. axios.create({ baseURL: ..., withCredentials: true })

  useEffect(() => {
    // Load Google Identity Services script dynamically
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn("REACT_APP_GOOGLE_CLIENT_ID not set. Google Sign-In disabled.");
      return;
    }

    const id = "google-identity-script";
    if (document.getElementById(id)) {
      initGoogle(clientId);
      return;
    }

    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.id = id;
    s.async = true;
    s.defer = true;
    s.onload = () => initGoogle(clientId);
    document.body.appendChild(s);

    return () => {
      // optionally remove script on unmount; keeping is fine
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function initGoogle(clientId) {
    if (!window.google || !window.google.accounts || !googleButtonRef.current) return;

    // initialize with a callback that receives the credential (ID token)
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredentialResponse,
      // optional: ux_mode: 'popup' // default is automatic UI
    });

    // render a standardized Google button inside our div
    window.google.accounts.id.renderButton(
      googleButtonRef.current,
      { theme: "outline", size: "large", width: "280" } // customizing size/style
    );

    // Optionally skip the One Tap prompt, or show it:
    // window.google.accounts.id.prompt(); // auto prompt (careful with UX)
  }

  async function handleGoogleCredentialResponse(response) {
    // response.credential is the ID token (JWT) you should send to backend for verification
    const idToken = response?.credential;
    if (!idToken) {
      setError("Google sign-in failed (no token).");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/google", { credential: idToken });
      if (res?.data?.user) {
        setUser(res.data.user);
        navigate("/");
        return;
      }
      // fallback to /me
      const me = await api.get("/api/auth/me");
      if (me?.data?.user) {
        setUser(me.data.user);
        navigate("/");
        return;
      }
      setError("Google login succeeded but user info missing.");
    } catch (err) {
      console.error("Google login error:", err?.response?.data || err);
      setError(err?.response?.data?.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/login", form);
      if (res?.data?.user) {
        setUser(res.data.user);
        navigate("/");
        return;
      }
      // fallback hydrate
      const me = await api.get("/api/auth/me");
      if (me?.data?.user) {
        setUser(me.data.user);
        navigate("/");
        return;
      }
      setError("Login succeeded but user info missing. Try refreshing.");
    } catch (err) {
      console.error("Login error:", err?.response?.data || err);
      setError(err?.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={submit} className={styles.form} autoComplete="on">
        <h2 className={styles.title}>Welcome Back</h2>
        <p className={styles.subtitle}>Login to continue</p>

        {error && <div className={styles.error}>{error}</div>}

        <input
          className={styles.input}
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          autoComplete="email"
        />

        <input
          className={styles.input}
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          autoComplete="current-password"
        />

        <div className={styles.row}>
          <Link to="/forgot-password" className={styles.link}>
            Forgot password?
          </Link>
        </div>

        <button type="submit" className={styles.button} disabled={loading}>
          {loading ? "Logging in…" : "Login"}
        </button>

        {/* Google button target */}
        <div ref={googleButtonRef} style={{ display: "flex", justifyContent: "center" }} />

        <div className={styles.signUpRow}>
          <span>Don't have an account?</span><br/>
          <Link to="/register" className={styles.link}>
            Sign-up
          </Link>
        </div>
      </form>
    </div>
  );
}
