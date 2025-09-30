// src/components/PhoneOTP.jsx
import React, { useEffect, useState, useContext } from "react";
import { auth } from "../firebaseClient";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import axios from "axios";
import { AuthContext } from "../contexts/AuthContext";

export default function PhoneOTP() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const { setToken } = useContext(AuthContext);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // sanity checks
    if (!auth) {
      console.error("Firebase auth is undefined. Check firebaseClient.js and env vars.");
      return;
    }

    // If a verifier is already initialized globally, reuse it (prevents "already rendered" errors)
    if (window.__recaptchaVerifierInitialized && window.recaptchaVerifier) {
      // already set up
      return;
    }

    const container = document.getElementById("recap-container");
    if (!container) {
      console.warn("recap-container not found — recaptcha init skipped");
      return;
    }

    // Create the RecaptchaVerifier only once.
    try {
      // If a verifier object exists but was not fully initialized, try to reuse it; else create a new one.
      if (!window.recaptchaVerifier) {
        // Correct parameter order: auth, containerId, params
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recap-container", {
          size: "invisible",
          callback: () => {
            /* recaptcha solved */
          },
        });
      }

      // Render only if widget not already rendered
      if (typeof window.__recaptchaWidgetId === "undefined") {
        window.recaptchaVerifier
          .render()
          .then((widgetId) => {
            window.__recaptchaWidgetId = widgetId;
            window.__recaptchaVerifierInitialized = true;
            console.log("reCAPTCHA initialized, widgetId:", widgetId);
          })
          .catch((err) => {
            console.warn("recaptcha render failed (may already be rendered):", err);
          });
      } else {
        window.__recaptchaVerifierInitialized = true;
      }
    } catch (err) {
      console.error("Recaptcha init error:", err);
    }

    // cleanup on unmount: reset grecaptcha and remove global verifier so HMR / navigation won't leave stale widget
    return () => {
      try {
        const wid = window.__recaptchaWidgetId;
        if (typeof wid !== "undefined" && window.grecaptcha && window.grecaptcha.reset) {
          window.grecaptcha.reset(wid);
        }
      } catch (e) {
        /* ignore cleanup errors */
      }
      // remove globals so a re-mount will recreate cleanly
      try {
        delete window.recaptchaVerifier;
        delete window.__recaptchaWidgetId;
        delete window.__recaptchaVerifierInitialized;
      } catch (_) {}
    };
  }, []);

  const sendCode = async () => {
    if (!phone || !/^\+\d{7,15}$/.test(phone)) {
      alert("Enter phone in E.164 format, e.g. +919876543210");
      return;
    }
    if (!auth) {
      alert("Auth not initialized. Check console for errors (firebase config).");
      return;
    }

    try {
      // Reuse existing verifier if present; else create one (same safe checks as above)
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recap-container", { size: "invisible" });
        await window.recaptchaVerifier.render();
        window.__recaptchaVerifierInitialized = true;
      }

      const res = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      setConfirmationResult(res);
      window.confirmationResult = res;
      alert("Code sent to " + phone);
    } catch (err) {
      console.error("sendCode error:", err);
      alert(
        err?.message ||
          "Error sending code. If testing locally, add a test phone in Firebase Console or use the Auth emulator."
      );

      // attempt to reset grecaptcha so user can retry
      try {
        const widgetId = window.__recaptchaWidgetId;
        if (typeof widgetId !== "undefined" && window.grecaptcha && window.grecaptcha.reset) {
          window.grecaptcha.reset(widgetId);
        }
      } catch (_) {}
    }
  };

  const verifyCode = async () => {
    try {
      const cr = confirmationResult || window.confirmationResult;
      if (!cr) {
        alert("No confirmation result - request code first");
        return;
      }
      const result = await cr.confirm(code);
      const firebaseIdToken = await result.user.getIdToken();

      const r = await axios.post(`${process.env.REACT_APP_API_BASE}/api/auth/verify-phone`, { firebaseIdToken });
      if (r.data.token) {
        setToken(r.data.token);
        alert("Phone verified & logged in");
      }
    } catch (err) {
      console.error("verifyCode error:", err);
      alert("Invalid code or verification failed");
    }
  };

  return (
    <div>
      {/* recaptcha container must exist in DOM */}
      <div id="recap-container" style={{ display: "none" }}></div>

      <input placeholder="+91xxxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <button onClick={sendCode}>Send SMS</button>

      <input placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
      <button onClick={verifyCode}>Verify Code</button>
    </div>
  );
}
