// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const BASE = process.env.REACT_APP_API_BASE || ""; // "" means relative to current host
axios.defaults.baseURL = BASE;                     // e.g. "http://localhost:4000" or "" for proxy
axios.defaults.withCredentials = true;            // crucial: send cookies with requests

export const AuthContext = createContext(null);

/**
 * AuthProvider - wraps app and exposes:
 * { user, setUser, logout, loading, isAuthenticated }
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true until we know if user is logged in

  useEffect(() => {
    let mounted = true;
    const fetchMe = async () => {
      try {
        const res = await axios.get("/api/auth/me"); // cookie sent automatically
        if (!mounted) return;
        setUser(res.data.user || null);
      } catch (err) {
        if (!mounted) return;
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchMe();
    return () => { mounted = false; };
  }, []);

  const logout = async () => {
    try {
      await axios.post("/api/auth/logout"); // server should clear the cookie
    } catch (err) {
      // still clear client state even if server call fails
      console.error("Logout error:", err?.response?.data || err.message || err);
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    setUser,
    logout,
    loading,
    isAuthenticated: Boolean(user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * useAuth - convenience hook to access AuthContext
 * Throws a helpful error if used outside of provider.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined || ctx === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
