// src/components/EmailOTPVerify.jsx
import React, { useState, useContext } from "react";
import axios from "axios";
import { AuthContext } from "../contexts/AuthContext";

const API = process.env.REACT_APP_API_BASE;

export default function EmailOTPVerify() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const { setToken } = useContext(AuthContext);

  const sendOtp = async () => {
    const r = await axios.post(`${API}/auth/send-email-otp`, { email });
    if (r.data.previewUrl) alert(`Dev email preview: ${r.data.previewUrl}`);
    alert("OTP sent");
  };

  const verify = async () => {
    const r = await axios.post(`${API}/auth/verify-email-otp`, { email, otp });
    if (r.data.token) {
      setToken(r.data.token);
      alert("Email verified — logged in");
    }
  };

  return (
    <div>
      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <button onClick={sendOtp}>Send OTP</button>
      <div>
        <input placeholder="Enter OTP" value={otp} onChange={e => setOtp(e.target.value)} />
        <button onClick={verify}>Verify</button>
      </div>
    </div>
  );
}
