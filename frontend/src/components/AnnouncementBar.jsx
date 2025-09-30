import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import styles from "./AnnouncementBar.module.css";

export default function AnnouncementBar() {
    const [announcements, setAnnouncements] = useState([]);
    const [index, setIndex] = useState(0);
    const [visible, setVisible] = useState(true);
    const mountedRef = useRef(true);
    const cycleRef = useRef(null);

    useEffect(() => {
        mountedRef.current = true;

        const fetchAnns = async () => {
            try {
                const { data } = await axios.get(
                    "https://universalparts.onrender.com/api/announcements"
                );
                if (!mountedRef.current) return;

                if (Array.isArray(data) && data.length) {
                    const sorted = [...data].sort(
                        (a, b) =>
                            (b.pinned - a.pinned) ||
                            (new Date(b.createdAt) - new Date(a.createdAt))
                    );

                    // remove ones dismissed in this browser session (stored by _id)
                    const dismissed = JSON.parse(
                        localStorage.getItem("announcements:dismissed") || "[]"
                    );
                    const filtered = sorted.filter((a) => !dismissed.includes(a._id));

                    setAnnouncements(filtered);
                    setIndex(0);
                } else {
                    setAnnouncements([]);
                }
            } catch (err) {
                console.error("Failed to fetch announcements:", err);
            }
        };

        fetchAnns();

        return () => {
            mountedRef.current = false;
        };
    }, []);

    // auto-cycle announcements every 8s
    useEffect(() => {
        if (!announcements.length || announcements.length === 1) return;
        clearInterval(cycleRef.current);
        cycleRef.current = setInterval(() => {
            setIndex((i) => (i + 1) % announcements.length);
        }, 8000);
        return () => clearInterval(cycleRef.current);
    }, [announcements]);

    const dismissCurrent = () => {
        const cur = announcements[index];
        if (!cur) return;
        const dismissed = JSON.parse(
            localStorage.getItem("announcements:dismissed") || "[]"
        );
        dismissed.push(cur._id);
        localStorage.setItem("announcements:dismissed", JSON.stringify(dismissed));

        const remaining = announcements.filter((a, idx) => idx !== index);
        setAnnouncements(remaining);
        setIndex(0);
    };

    const closeBar = () => {
        setVisible(false);
    };

    if (!visible || !announcements.length) return null;

    const top = announcements[index];

return (
  <div role="region" aria-live="polite" aria-label="Site announcements">
    <div
      className={`${styles["ann-bar"]} ${top.pinned ? styles.pinned : styles.celebrate}`}
    >
      <div className={styles["ann-content"]}>
        <div className={styles["ann-badge"]} aria-hidden="true">
          <span className={styles.emoji}>{top.emoji || "🎉"}</span>
        </div>

        <div className={styles["text-column"]} style={{ minWidth: 0 }}>
          <div className={styles["ann-text"]} title={top.title}>
            {top.title}
          </div>

          <div className={styles["message-body"]} aria-hidden={false}>
            <span
              dangerouslySetInnerHTML={{
                __html: top.message,
              }}
            />
          </div>
        </div>
      </div>

      <div className={styles["ann-meta"]}>
        <div className={styles["meta-row"]}>
          <time
            className={`${styles["meta-date"]} ${styles["hide-on-mobile"]}`}
            dateTime={top.createdAt}
          >
            {new Date(top.createdAt).toLocaleString()}
          </time>
        </div>
      </div>

      {/* Small dismiss cross (no big box) */}
      <button
        type="button"
        className={styles.closeBtn}
        onClick={dismissCurrent}
        aria-label="Dismiss announcement"
        title="Dismiss"
      >
        {/* simple accessible SVG cross; uses currentColor so it inherits text color */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  </div>
);
}
