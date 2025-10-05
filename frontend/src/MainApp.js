import React, { useEffect, useRef, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "./contexts/ThemeContext";
import { useAuth } from "./contexts/AuthContext";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";

import SearchBar from "./components/SearchBar";
import Results from "./components/Results";
import RegisterForm from "./components/RegisterForm";
import LoginForm from "./components/LoginForm";
import EmailOTPVerify from "./components/EmailOTPVerify";
import PhoneOTP from "./components/PhoneOTP";
import SubscriptionPage from "./pages/SubscriptionPage";
import UserDashboard from "./components/UserDashboard";
import BannerAd from "./components/BannerAd";
import QueryBot from "./components/QueryBot";
import { search, autocomplete } from "./utils/api";
import { fetchAdminParts } from "./utils/adminApi";
import styles from "./App.module.css";
import Chatbot from "./components/Chatbot";
import AnnouncementBar from "./components/AnnouncementBar";

// <-- NEW: import your logo from assets -->
import lightLogo from "./assets/GSMGUIDE1.jpg";
import darkLogo from "./assets/GSMGUIDE2.jpg";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";

function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={styles.themeToggle}
      aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDarkMode ? "☀️" : "🌙"}
    </button>
  );
}

function MainApp() {
    const { isDarkMode } = useTheme()
  const [isNativeMobile, setIsNativeMobile] = useState(false);
  // statusFixed = true means native layout was adjusted (no spacer needed)
  const [statusFixed, setStatusFixed] = useState(false);
  // detect platform once
  useEffect(() => {
    try {
      const p = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
      if (p === "ios" || p === "android") setIsNativeMobile(true);
    } catch (e) {
      // ignore
    }
  }, []);

  // Try to configure native status bar. If it succeeds, we hide spacer.
  useEffect(() => {
    if (!isNativeMobile) return;

    async function configureStatusBar() {
      try {
        // Read header background from CSS var so it follows dark/light theme
        const style = getComputedStyle(document.documentElement);
        let headerBg = style.getPropertyValue("--header-bg")?.trim() || (isDarkMode ? "#1e293b" : "#ffffff");

        // Sanitize value (remove quotes/spaces)
        headerBg = headerBg.replace(/['"]/g, "").trim();

        // If value is rgb(...) convert to hex (rare) — quick conversion
        if (headerBg.startsWith("rgb")) {
          const nums = headerBg.match(/\d+/g)?.slice(0, 3) || [255, 255, 255];
          headerBg = nums
            .map((n) => Number(n).toString(16).padStart(2, "0"))
            .join("");
        } else {
          // if headerBg starts with '#', remove it (StatusBar expects no #)
          headerBg = headerBg.startsWith("#") ? headerBg.slice(1) : headerBg;
        }

        // Ask native not to overlay the webview
        await StatusBar.setOverlaysWebView({ overlay: false });

        // Set native status bar background (hex without '#')
        await StatusBar.setBackgroundColor({ color: headerBg });

        // Decide icon color (light/dark) from luminance
        const hexToRgb = (h) => {
          if (h.length === 3) {
            return h.split("").map((c) => parseInt(c + c, 16));
          }
          return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
        };
        const [r, g, b] = hexToRgb(headerBg.length === 6 ? headerBg : "ffffff");
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const useLightContent = luminance < 0.5; // darker bg -> use light content (icons/text)

        await StatusBar.setStyle({ style: useLightContent ? Style.Light : Style.Dark });

        // native fix applied -> hide spacer
        setStatusFixed(true);
      } catch (e) {
        console.warn("StatusBar config failed", e);
        // keep spacer as fallback
        setStatusFixed(false);
      }
    }

    configureStatusBar();
  }, [isNativeMobile, isDarkMode]);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // ---- search state ----
  const [device, setDevice] = useState(null);
  const [groups, setGroups] = useState([]);
  const [mergedGroups, setMergedGroups] = useState([]);
  const [part, setPart] = useState("");
  const [parts, setParts] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function loadParts() {
      try {
        const list = await fetchAdminParts();
        setParts(list || []);
      } catch (err) {
        console.error("Failed to load parts", err);
      }
    }
    loadParts();
  }, []);

  async function fetchGroupsForDevice(deviceSlug, partSlug) {
    if (!deviceSlug) return [];
    try {
      const json = await search(deviceSlug, partSlug || undefined);
      const arr = json?.groups || [];

      const sel =
        parts.find((p) => p.slug === partSlug) ||
        (partSlug ? { slug: partSlug, name: partSlug } : null);

      return arr.map((g) => {
        if (Array.isArray(g._parts) && g._parts.length) return g;
        if (sel) return { ...g, _parts: [{ slug: sel.slug, name: sel.name }] };
        return g;
      });
    } catch (err) {
      console.error("search() failed", err);
      return [];
    }
  }

  useEffect(() => {
    async function refetch() {
      if (!device) return setGroups([]);
      setGroups(await fetchGroupsForDevice(device.slug, part));
    }
    refetch();
  }, [device, part, parts]);

  useEffect(() => {
    async function loadMerged() {
      if (!device) return setMergedGroups([]);
      setMergedGroups(await fetchGroupsForDevice(device.slug, ""));
    }
    loadMerged();
  }, [device, parts]);

  async function onSelectDevice(d) {
    setDevice(d);
    setMergedGroups(await fetchGroupsForDevice(d.slug, ""));
    setGroups(await fetchGroupsForDevice(d.slug, part));
    document.getElementById("results-heading")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handlePartSelect(slug) {
    setPart(slug || "");
  }

  async function universalSearch() {
    if (!query.trim()) return;
    const res = await autocomplete(query.trim());
    if (res?.length) onSelectDevice(res[0]);
  }

  async function onFeelingLucky() {
    if (!query.trim()) return;
    const res = await autocomplete(query.trim());
    if (res?.length) {
      const pick = res[Math.floor(Math.random() * res.length)];
      onSelectDevice(pick);
    }
  }

  // header: user menu state & refs
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const userBtnRef = useRef(null);

  // click outside to close user menu
  useEffect(() => {
    function onDoc(e) {
      if (
        userMenuOpen &&
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target) &&
        userBtnRef.current &&
        !userBtnRef.current.contains(e.target)
      ) {
        setUserMenuOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === "Escape") setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen]);

  async function handleLogout() {
    try {
      await logout?.();
    } catch (err) {
      console.error("logout failed", err);
    } finally {
      setUserMenuOpen(false);
      navigate("/login");
    }
  }

  function handleProfileClick() {
    setUserMenuOpen(false);
    navigate("/dashboard");
  }

  return (
    <div className={styles.page}>
      {isNativeMobile && !statusFixed && (
        <div className={styles.statusSpacer} aria-hidden="true" />
      )}
      <header className={styles.header}>
        {/* BRAND / LEFT */}
        <div className={styles.headerLeft}>
          <button
            className={styles.brand}
            onClick={() => navigate("/")}
            aria-label="GSMGuide home"
            title="Home"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            {/* Use logo image; if it errors, hide the image (keeps accessibility) */}
            <img
              src={isDarkMode ? darkLogo : lightLogo}
              alt="GSMGuide logo"
              className={styles.brandLogo}
              onError={(e) => {
                // hide broken image so your layout falls back to text if needed
                e.currentTarget.style.display = "none";
              }}
              style={{ height: 40, width: "auto", objectFit: "contain" }}
            />

            {/* Optional fallback text for screenreaders or when image is hidden */}
            <span className={styles.srOnly}>GSMGuide</span>
          </button>
        </div>

        <nav className={styles.headerRight}>
          <ThemeToggle />
          <button className={styles.headerLink} onClick={() => navigate("/")}>Home</button>
          <button className={styles.headerLink} onClick={() => navigate("/subscribe")}>Subscribe</button>

          {/* conditional auth UI */}
          {!user ? (
            <>
              <button className={styles.headerLink} onClick={() => navigate("/login")}>Login</button>
            </>
          ) : (
            <>
              <div style={{ position: "relative", display: "inline-block" }}>
                <button
                  ref={userBtnRef}
                  className={styles.headerLink}
                  onClick={() => setUserMenuOpen((s) => !s)}
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen}
                  aria-controls="user-menu"
                  title="Account menu"
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.firstName || "User"} className={styles.userAvatar} style={{ width: 28, height: 28, borderRadius: 999 }} />
                  ) : (
                    <div className={styles.userIcon} style={{ width: 28, height: 28, borderRadius: 999, background: "#222", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                      {user?.firstName ? user.firstName[0].toUpperCase() : "U"}
                    </div>
                  )}
                </button>

                {userMenuOpen && (
                  <div
                    id="user-menu"
                    ref={userMenuRef}
                    role="menu"
                    aria-labelledby="user-menu-button"
                    style={{
                      position: "absolute",
                      right: 0,
                      marginTop: 8,
                      minWidth: 160,
                      background: "var(--dropdown-bg)",
                      border: "1px solid var(--border-color)",
                      boxShadow: "var(--shadow-lg)",
                      borderRadius: 8,
                      zIndex: 40,
                      padding: 8,
                      color: "var(--text-primary)",
                    }}
                  >
                    <button
                      role="menuitem"
                      onClick={handleProfileClick}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 12px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-primary)",
                        borderRadius: 4,
                      }}
                      onMouseEnter={(e) => e.target.style.background = "var(--bg-secondary)"}
                      onMouseLeave={(e) => e.target.style.background = "transparent"}
                    >
                      Profile
                    </button>

                    <button
                      role="menuitem"
                      onClick={handleLogout}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 12px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-primary)",
                        borderRadius: 4,
                      }}
                      onMouseEnter={(e) => e.target.style.background = "var(--bg-secondary)"}
                      onMouseLeave={(e) => e.target.style.background = "transparent"}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </nav>
      </header>

      <Routes>
        {/* Home */}
        <Route
          path="/"
          element={
            <>
              <main className={styles.main}>
                <div className={styles.logoWrap}>
                  <h1 className={styles.logo} aria-label="Universal Parts">
                    <span className={styles.g1}>G</span>
                    <span className={styles.g2}>S</span>
                    <span className={styles.g3}>M</span>
                    <span className={styles.sep}> </span>
                    <span className={styles.g5}>G</span>
                    <span className={styles.g1}>u</span>
                    <span className={styles.g2}>i</span>
                    <span className={styles.g3}>d</span>
                    <span className={styles.g4}>e</span>
                  </h1>
                  <p className={styles.tagline}>Search Compatibilities, Parts & Models</p>
                </div>

                <div className={styles.searchWrap}>
                  <SearchBar
                    onSelect={onSelectDevice}
                    parts={parts}
                    part={part}
                    onPartChange={setPart}
                    query={query}
                    setQuery={setQuery}
                  />
                </div>
              </main>

              <section className={styles.resultsArea}>
                <Results
                  device={device}
                  groups={groups}
                  allGroups={mergedGroups}
                  parts={parts}
                  selectedPart={parts.find((p) => p.slug === part) || null}
                  onPartSelect={handlePartSelect}
                />
              </section>
              <AnnouncementBar />
              <BannerAd />
              {/* <QueryBot searchInputId="site-search-input" whatsappNumber="919876543210" /> */}
              <Chatbot />
            </>
          }
        />

        {/* Auth */}
        <Route path="/login" element={<main className={styles.main}><LoginForm /></main>} />
        <Route path="/register" element={<main className={styles.main}><RegisterForm /></main>} />
        <Route path="/verify-email" element={<main className={styles.main}><EmailOTPVerify /></main>} />
        <Route path="/verify-phone" element={<main className={styles.main}><PhoneOTP /></main>} />
        <Route path="/forgot-password" element={<main className={styles.main}><ForgotPassword /></main>} />
        <Route path="/reset-password/:token" element={<main className={styles.main}><ResetPassword /></main>} />


        {/* User Dashboard */}
        <Route path="/dashboard" element={<UserDashboard />} />

        {/* Subscribe */}
        <Route path="/subscribe" element={<main className={styles.main}><SubscriptionPage /></main>} />
      </Routes>

      <footer className={styles.footer}>
        <div className={styles.footerLeft}><span>India</span></div>
        <div className={styles.footerRight}>
          <a href="#">About</a>
          <a href="#">Store</a>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
        </div>
      </footer>
    </div>
  );
}

export default MainApp;
