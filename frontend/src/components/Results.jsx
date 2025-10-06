import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './Results.module.css';

/**
 * Props:
 *  - device
 *  - groups = []              // currently-displayed groups (filtered by part)
 *  - allGroups = null         // (optional) full merged groups across all parts — used for counts
 *  - selectedPart
 *  - parts = []
 *  - onPartSelect(slug)
 */
export default function Results({
  device,
  groups = [],
  allGroups = null,
  selectedPart,
  parts = [],
  onPartSelect = () => {},
}) {
  // UI state
  const [focusedTab, setFocusedTab] = useState(0);
  const tablistRef = useRef(null);

  // which tab is active (slug or '' for All)
  const [activeSlug, setActiveSlug] = useState(selectedPart?.slug || '');
  useEffect(() => setActiveSlug(selectedPart?.slug || ''), [selectedPart?.slug]);

  // per-group expanded state (for mobile accordions)
  const [expandedMap, setExpandedMap] = useState({});

  // If viewport is small, default groups to collapsed; on large screens expanded
  useEffect(() => {
    function setDefaults() {
      const isMobile = window?.innerWidth <= 720;
      const map = {};
      for (const g of groups) {
        const key = g._id || JSON.stringify(g);
        map[key] = !isMobile; // expanded on desktop, collapsed on mobile
      }
      setExpandedMap(map);
    }
    setDefaults();
    // update on resize for a nicer UX
    function onResize() {
      setDefaults();
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [groups]);

  // normalization helper
  const normalizeKey = (val) => String(val || '').trim().toLowerCase();

  // Choose source for counts/availableParts: prefer allGroups if provided
  const sourceGroups = Array.isArray(allGroups) ? allGroups : groups;

  // Build lookups from parts prop (slug / id / name) so we only treat known parts as authoritative
  const { bySlug, byId, byName } = useMemo(() => {
    const bs = new Map();
    const bi = new Map();
    const bn = new Map();

    if (Array.isArray(parts)) {
      for (const p of parts) {
        if (!p) continue;
        const slug = String(p.slug || '').trim();
        const id = String(p._id || p.id || '').trim();
        const name = String(p.name || '').trim();
        if (slug) bs.set(slug.toLowerCase(), { slug, name });
        if (id) bi.set(id, { slug: p.slug || id, name: p.name || p.slug || id });
        if (name) bn.set(name.toLowerCase(), { slug: p.slug || name, name });
      }
    }

    return { bySlug: bs, byId: bi, byName: bn };
  }, [parts]);

  // helper: try to resolve a candidate (slug | id | name) -> {slug,name} or null
  function resolveCandidate(value) {
    if (!value && value !== 0) return null;
    const s = String(value).trim();
    if (!s) return null;
    // id exact match first
    if (byId.has(s)) return byId.get(s);
    const norm = s.toLowerCase();
    if (bySlug.has(norm)) return bySlug.get(norm);
    if (byName.has(norm)) return byName.get(norm);
    return null;
  }

  // Filter sourceGroups to exclude groups that reference only unknown raw part ids.
  // Keep groups that either have resolvable _parts entries, or have no part reference at all.
  const filteredSourceGroups = useMemo(() => {
    if (!Array.isArray(sourceGroups)) return [];
    return sourceGroups.filter((g) => {
      if (!g) return false;

      // explicit _parts: keep only if any entry resolves to known part
      if (Array.isArray(g._parts) && g._parts.length) {
        for (const pp of g._parts) {
          const candidate = pp?.slug || pp?.name;
          if (candidate && resolveCandidate(candidate)) return true;
        }
        // _parts present but none resolvable -> drop the group
        return false;
      }

      // partId present: keep only if it resolves against known parts
      if (g.partId) {
        return !!resolveCandidate(g.partId);
      }

      // neither _parts nor partId -> assume generic group, keep it
      return true;
    });
  }, [sourceGroups, byId, bySlug, byName]);

  // Now build availableParts and counts using filteredSourceGroups
  const { availableParts, countsByPart } = useMemo(() => {
    const partMap = new Map(); // norm -> { slug, name, count }

    // Seed from parts prop (authoritative list)
    if (Array.isArray(parts)) {
      for (const p of parts) {
        if (!p) continue;
        const slug = p.slug || String(p._id || p.name || '');
        const name = p.name || p.slug || String(p._id || '');
        const norm = normalizeKey(slug || name);
        if (!norm) continue;
        if (!partMap.has(norm)) partMap.set(norm, { slug: p.slug || slug, name, count: 0 });
      }
    }

    // Also include resolvable parts referenced by groups
    for (const g of filteredSourceGroups || []) {
      if (!g) continue;
      if (Array.isArray(g._parts) && g._parts.length) {
        for (const pp of g._parts) {
          const candidate = pp?.slug || pp?.name;
          const resolved = resolveCandidate(candidate) || (pp?.name ? { slug: pp.slug || pp.name, name: pp.name } : null);
          if (!resolved) continue;
          const norm = normalizeKey(resolved.slug || resolved.name);
          if (!norm) continue;
          if (!partMap.has(norm)) partMap.set(norm, { slug: resolved.slug, name: resolved.name, count: 0 });
        }
      } else if (g.partId) {
        const resolved = resolveCandidate(g.partId);
        if (!resolved) continue;
        const norm = normalizeKey(resolved.slug || resolved.name);
        if (!norm) continue;
        if (!partMap.has(norm)) partMap.set(norm, { slug: resolved.slug, name: resolved.name, count: 0 });
      }
    }

    // Count groups per part (avoid double counting same group for same part)
    for (const g of filteredSourceGroups || []) {
      if (!g) continue;
      const seenThisGroup = new Set();

      if (Array.isArray(g._parts) && g._parts.length) {
        for (const pp of g._parts) {
          const candidate = pp?.slug || pp?.name;
          const resolved = resolveCandidate(candidate) || (pp?.name ? { slug: pp.slug || pp.name, name: pp.name } : null);
          if (!resolved) continue;
          const norm = normalizeKey(resolved.slug || resolved.name);
          if (partMap.has(norm) && !seenThisGroup.has(norm)) {
            partMap.get(norm).count += 1;
            seenThisGroup.add(norm);
          }
        }
      } else if (g.partId) {
        const resolved = resolveCandidate(g.partId);
        if (!resolved) continue;
        const norm = normalizeKey(resolved.slug || resolved.name);
        if (partMap.has(norm) && !seenThisGroup.has(norm)) {
          partMap.get(norm).count += 1;
          seenThisGroup.add(norm);
        }
      }
    }

    // build available parts array
    const allEntry = { slug: '', name: 'All', count: (filteredSourceGroups && filteredSourceGroups.length) || 0 };
    const rest = Array.from(partMap.values()).map((v) => ({ slug: v.slug, name: v.name, count: v.count }));

    rest.sort((a, b) => {
      if ((b.count || 0) !== (a.count || 0)) return (b.count || 0) - (a.count || 0);
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return 0;
    });

    const countsMap = new Map();
    countsMap.set('', allEntry.count);
    for (const p of rest) countsMap.set(p.slug || p.name || '', p.count || 0);

    // debug
    // console.debug('Results debug (resolved parts):', {
    //   filteredSourceGroupsLength: (filteredSourceGroups && filteredSourceGroups.length) || 0,
    //   availableParts: [allEntry, ...rest].slice(0, 30),
    //   counts: Array.from(countsMap.entries()).slice(0, 30),
    // });

    return { availableParts: [allEntry, ...rest], countsByPart: countsMap };
  }, [parts, filteredSourceGroups]);

  // displayed groups filtered by activeSlug — use groups prop but filter out groups that reference unknown parts
  const displayedGroups = useMemo(() => {
    // pre-filter groups to drop those that reference only unknown parts (keep generic groups)
    const visibleGroups = (groups || []).filter((g) => {
      if (!g) return false;
      if (Array.isArray(g._parts) && g._parts.length) {
        // keep if any _parts resolvable
        return g._parts.some((pp) => {
          const cand = pp?.slug || pp?.name;
          return !!resolveCandidate(cand);
        });
      }
      if (g.partId) {
        // keep only if partId resolves
        return !!resolveCandidate(g.partId);
      }
      return true;
    });

    if (!activeSlug) return visibleGroups;
    return visibleGroups.filter((g) => {
      if (!g) return false;
      if (Array.isArray(g._parts) && g._parts.length) {
        return g._parts.some((p) => {
          const candidate = p?.slug || p?.name || '';
          return normalizeKey(candidate) === normalizeKey(activeSlug);
        });
      }
      if (g.partId) {
        const resolved = resolveCandidate(g.partId);
        if (!resolved) return false;
        return normalizeKey(resolved.slug || resolved.name || '') === normalizeKey(activeSlug);
      }
      return false;
    });
  }, [groups, activeSlug, byId, bySlug, byName]);

  // keyboard nav helpers for tabs
  function focusTab(idx) {
    const root = tablistRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll('[role="tab"]');
    const n = nodes[idx];
    if (n && typeof n.focus === 'function') n.focus();
  }

  function onTabKeyDown(e) {
    const count = availableParts.length;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (focusedTab + 1) % count;
      setFocusedTab(next);
      focusTab(next);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (focusedTab - 1 + count) % count;
      setFocusedTab(prev);
      focusTab(prev);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusedTab(0);
      focusTab(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setFocusedTab(count - 1);
      focusTab(count - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const p = availableParts[focusedTab];
      if (p) {
        setActiveSlug(p.slug || '');
        onPartSelect(p.slug || '');
      }
    }
  }

  // keep focusedTab aligned with activeSlug (use sorted availableParts)
  useEffect(() => {
    const idx = Math.max(
      0,
      availableParts.findIndex((p) => normalizeKey(p.slug || p.name || '') === normalizeKey(activeSlug || ''))
    );
    setFocusedTab(idx >= 0 ? idx : 0);
  }, [availableParts, activeSlug]);

  if (!device) return null;

  // clicking a tab or badge
  function handleSelectPart(slug) {
    setActiveSlug(slug || '');
    onPartSelect(slug || '');
    // on mobile, also expand groups for visibility
    const newMap = { ...expandedMap };
    for (const g of groups) {
      const key = g._id || JSON.stringify(g);
      newMap[key] = true;
    }
    setExpandedMap(newMap);
  }

  // improved label for parts (avoid printing raw ids)
  function groupPartsLabel(g) {
    if (g && Array.isArray(g._parts) && g._parts.length) {
      return g._parts.map((p) => p.name || p.slug).filter(Boolean).join(', ');
    }
    if (selectedPart) return selectedPart.name;
    if (g && g.partId) {
      const match = resolveCandidate(g.partId);
      return (match && (match.name || match.slug)) || 'Unknown part';
    }
    return 'Part';
  }

  // toggle a single group's accordion state
  function toggleGroup(g) {
    const key = g._id || JSON.stringify(g);
    setExpandedMap((m) => ({ ...m, [key]: !m[key] }));
  }

  // render
  return (
    <section className={styles.resultsContainer} aria-labelledby="results-heading">
      {/* APP BAR */}
      <div className={styles.appBarWrap}>
        <nav
          className={styles.appBar}
          role="tablist"
          aria-label="Parts"
          ref={tablistRef}
          onKeyDown={onTabKeyDown}
        >
          {availableParts.map((p, i) => {
            const isAll = (p.slug || '') === '';
            const isSelected = normalizeKey(p.slug || p.name || '') === normalizeKey(activeSlug || '');
            const countKey = p.slug || p.name || '';
            const count = countsByPart.get(countKey) ?? 0;
            return (
              <button
                key={p.slug || `all-${i}`}
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                className={`${styles.tab} ${isSelected ? styles.tabActive : ''}`}
                onClick={() => handleSelectPart(p.slug || '')}
                onFocus={() => setFocusedTab(i)}
                title={isAll ? p.name : `${p.name} (${count})`}
              >
                <span className={styles.tabLabel}>{p.name}</span>
                {!isAll && <span className={styles.tabCount}>{count}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* DEVICE HEADER */}
      <header className={styles.deviceHeader}>
        <div className={styles.deviceLeft}>
          <div className={styles.brand}>{device.brand?.name}</div>
          <h2 id="results-heading" className={styles.deviceName}>{device.name}</h2>
          {device.aliases?.length > 0 && (
            <div className={styles.aliases} aria-hidden>
              Aliases: {device.aliases.slice(0, 3).join(', ')}{device.aliases.length > 3 ? '…' : ''}
            </div>
          )}
        </div>

        <div className={styles.deviceRight}>
          <div className={styles.meta}>
            <span className={styles.metaLabel}>Groups</span>
            <span className={styles.metaValue}>{displayedGroups.length}</span>
          </div>
        </div>
      </header>

      {/* GROUPS LIST */}
      {displayedGroups.length === 0 ? (
        <div className={styles.noGroups} role="status">
          <p>No compatibility groups found for this device in the selected part.</p>
        </div>
      ) : (
        <div className={styles.groupsList}>
          {displayedGroups.map((g) => {
            const key = g._id || JSON.stringify(g);
            const isExpanded = !!expandedMap[key];
            const models = Array.isArray(g.models) ? g.models : [];
            return (
              <article key={key} className={`${styles.groupCard} ${isExpanded ? styles.expanded : ''}`}>
                <div className={styles.groupHeader}>
                  <div>
                    <h3 id={`group-${key}`} className={styles.groupTitle}>{groupPartsLabel(g)}</h3>
                    {g.note && <div className={styles.groupNote}>({g.note})</div>}
                  </div>

                  {/* accordion toggle (visible on mobile) */}
                  <div className={styles.headerActions}>
                    <div className={styles.modelsCount} aria-hidden>
                      {models.length} <span className={styles.modelsLabel}>models</span>
                    </div>
                    <button
                      className={styles.expandBtn}
                      aria-expanded={isExpanded}
                      aria-controls={`models-${key}`}
                      onClick={() => toggleGroup(g)}
                    >
                      <span className={styles.expandIcon} aria-hidden>{isExpanded ? '▾' : '▸'}</span>
                      <span className={styles.expandText}>{isExpanded ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                </div>

                {/* models grid (collapsible on mobile) */}
                <div
                  id={`models-${key}`}
                  className={`${styles.modelsGrid} ${isExpanded ? styles.open : styles.collapsed}`}
                >
                  {models.map((m, idx) => (
                    <div key={m._id || idx} className={styles.modelCard}>
                      <div className={styles.modelTop}>
                        <div className={styles.modelBrand}>{m.brand?.name}</div>
                        <div className={styles.modelName}>{m.name}</div>
                      </div>
                      <div className={styles.modelFooter}>
                        <span className={styles.modelBadge}>{m.variant || m.year || 'Model'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
