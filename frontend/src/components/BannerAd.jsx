import React, { useEffect, useRef, useState } from "react";
import styles from "./BannerAd.module.css";

/**
 * Google-like ad cards:
 * - shows up to 3 cards in a responsive row (desktop)
 * - each card has small "Ad · Sponsored" label and a dismiss (session)
 * - supports image / video / html / native (title + desc)
 *
 * Props:
 * - placement, device, part, rotateMs (not used for grid but kept)
 */
export default function BannerAd({ placement = "header", device, part, rotateMs = 9000 }) {
  const [ads, setAds] = useState([]);
  const containerRef = useRef(null);
  const visibleTimers = useRef({});
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("adsDismissed") || "{}");
    } catch { return {}; }
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const q = new URLSearchParams({ placement });
        if (device) q.set("device", device);
        if (part) q.set("part", part);
        const res = await fetch(`https://universalparts.onrender.com/api/ads?${q.toString()}`);
        const json = await res.json();
        if (!cancelled) setAds(json.ads || []);
      } catch (err) {
        console.error("BannerAd load failed", err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [placement, device, part]);

  // helper: build full URL for asset
  function makePublicUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    return `https://universalparts.onrender.com${url.startsWith('/') ? url : '/' + url}`;
  }

  // helper: extract hostname for favicon + display
  function getHostname(url) {
    try {
      const u = new URL(url.startsWith("http") ? url : `http://${url}`);
      return u.hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  // Impression tracking (per-card)
  useEffect(() => {
    if (!containerRef.current || !ads.length) return;
    const observed = new Set();
    const io = new IntersectionObserver(entries => {
      for (const ent of entries) {
        const adId = ent.target.getAttribute("data-ad-id");
        if (!adId) continue;
        const isVisible = ent.intersectionRatio >= 0.5;
        if (isVisible && !observed.has(adId) && !visibleTimers.current[adId]) {
          visibleTimers.current[adId] = setTimeout(() => {
            sendImpression(adId);
            observed.add(adId);
            delete visibleTimers.current[adId];
          }, 700); // slightly faster than before for card grid
        } else if (!isVisible && visibleTimers.current[adId]) {
          clearTimeout(visibleTimers.current[adId]);
          delete visibleTimers.current[adId];
        }
      }
    }, { threshold: [0, 0.5] });

    const nodes = containerRef.current.querySelectorAll("[data-ad-id]");
    nodes.forEach(n => io.observe(n));

    return () => {
      io.disconnect();
      Object.values(visibleTimers.current).forEach(clearTimeout);
      visibleTimers.current = {};
    };
  }, [ads]);

  function sendImpression(adId) {
    try {
      const body = JSON.stringify({ placement, ts: Date.now() });
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(`https://universalparts.onrender.com/api/ads/${adId}/impression`, blob);
      } else {
        fetch(`https://universalparts.onrender.com/api/ads/${adId}/impression`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      }
    } catch { /* ignore */ }
  }

  function handleClick(ad) {
    try {
      const body = JSON.stringify({ placement, ts: Date.now() });
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(`https://universalparts.onrender.com/api/ads/${ad._id}/click`, blob);
      } else {
        fetch(`https://universalparts.onrender.com/api/ads/${ad._id}/click`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
      }
    } catch { /* swallow */ }
    if (ad.targetUrl) window.open(ad.targetUrl, "_blank", "noopener,noreferrer");
  }

  function dismissAd(adId) {
    const next = { ...(dismissed || {}) };
    next[adId] = true;
    setDismissed(next);
    try { sessionStorage.setItem("adsDismissed", JSON.stringify(next)); } catch {}
  }

  // show up to 3 cards; filter out dismissed
  const visibleAds = (ads || []).filter(a => !dismissed[a._id]).slice(0, 3);

  if (!visibleAds.length) {
    return (
      <div className={styles.fallback}>
        <div className={styles.placeholder}>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} ref={containerRef} role="region" aria-label="Sponsored content">
      <div className={styles.headerRow}>
        <div className={styles.adTag}>Ad</div>
        <div className={styles.headerText}>Sponsored</div>
      </div>

      <div className={styles.grid}>
        {visibleAds.map(ad => {
          // native fallback: try to get description from ad.html (strip tags) or use title
          let desc = "";
          if (ad.html) {
            try { desc = ad.html.replace(/<\/?[^>]+(>|$)/g, "").slice(0, 140); } catch { desc = ""; }
          }
          const domain = ad.targetUrl ? getHostname(ad.targetUrl) : (ad.imageUrl ? getHostname(ad.imageUrl) : "");
          const favicon = domain ? `https://www.google.com/s2/favicons?domain=${domain}` : null;

          return (
            <article key={ad._id} className={styles.card} data-ad-id={ad._id}>
              <div className={styles.cardTop}>
                <div className={styles.cardMeta}>
                  {favicon && <img src={favicon} alt="" className={styles.favicon} />}
                  <div className={styles.metaText}>
                    <div className={styles.title}>{ad.title || domain || "Sponsored"}</div>
                    {domain && <div className={styles.domain}>{domain}</div>}
                  </div>
                </div>
                <button className={styles.closeBtn} aria-label="Dismiss ad" onClick={() => dismissAd(ad._id)}>×</button>
              </div>

              <div className={styles.cardBody} onClick={() => handleClick(ad)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") handleClick(ad); }}>
                {ad.type === "image" && ad.imageUrl && (
                  <img src={makePublicUrl(ad.imageUrl)} alt={ad.title || "Ad image"} className={styles.heroImage} />
                )}

                {ad.type === "video" && ad.imageUrl && (
                  <video src={makePublicUrl(ad.imageUrl)} className={styles.heroVideo} controls muted playsInline />
                )}

                {ad.type === "html" && ad.html && (
                  <div className={styles.htmlWrap} dangerouslySetInnerHTML={{ __html: ad.html }} />
                )}

                {/* native text fallback */}
                {!ad.imageUrl && !ad.html && (
                  <div className={styles.textFallback}>
                    <div className={styles.headline}>{ad.title || domain || "Sponsored content"}</div>
                    <div className={styles.description}>{desc || "Learn more about this offer."}</div>
                  </div>
                )}
              </div>

              <div className={styles.cardFooter}>
                <button className={styles.ctaBtn} onClick={() => handleClick(ad)}>Visit</button>
                <div className={styles.metrics}>
                  <span>{(ad.impressions || 0).toLocaleString()} views</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
