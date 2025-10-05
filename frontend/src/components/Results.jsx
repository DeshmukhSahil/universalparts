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
  onPartSelect = () => { },
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

  //
  // Build the base unsorted list of parts (so counts calculation isn't circular).
  // We'll sort this list afterwards using countsByPart.
  //
  const availablePartsBase = useMemo(() => {
    const map = new Map();
    map.set('', { slug: '', name: 'All' });

    if (Array.isArray(parts)) {
      for (const p of parts) {
        const key = normalizeKey(p.slug || p.name || '');
        if (!key) continue;
        if (!map.has(key)) map.set(key, { slug: p.slug || p.name || key, name: p.name || p.slug || key });
      }
    }

    for (const g of sourceGroups || []) {
      if (!g || !Array.isArray(g._parts)) continue;
      for (const p of g._parts) {
        if (!p) continue;
        const key = normalizeKey(p.slug || p.name || '');
        if (!key) continue;
        if (!map.has(key)) map.set(key, { slug: p.slug || p.name || key, name: p.name || p.slug || key });
      }
    }

    return Array.from(map.values());
  }, [parts, sourceGroups]);

  // counts (All = total groups) — computed from sourceGroups so counts stay stable
  // const countsByPart = useMemo(() => {
  //   const counts = new Map();
  //   counts.set('', (sourceGroups && sourceGroups.length) || 0); // All

  //   for (const p of availablePartsBase) {
  //     const key = p.slug || p.name || '';
  //     if (key === '') continue;
  //     counts.set(key, 0);
  //   }

  //   const normToKey = new Map();
  //   for (const p of availablePartsBase) {
  //     const norm = normalizeKey(p.slug || p.name || '');
  //     if (!norm) continue;
  //     normToKey.set(norm, p.slug || p.name || norm);
  //   }

  //   for (const g of sourceGroups || []) {
  //     const seen = new Set();
  //     if (g && Array.isArray(g._parts) && g._parts.length) {
  //       for (const p of g._parts) {
  //         const norm = normalizeKey(p?.slug || p?.name || '');
  //         if (!norm) continue;
  //         const key = normToKey.get(norm);
  //         if (key && !seen.has(key)) {
  //           counts.set(key, (counts.get(key) || 0) + 1);
  //           seen.add(key);
  //         }
  //       }
  //     } else if (g && g.partId) {
  //       const norm = normalizeKey(g.partId);
  //       const key = normToKey.get(norm);
  //       if (key && !seen.has(key)) {
  //         counts.set(key, (counts.get(key) || 0) + 1);
  //         seen.add(key);
  //       }
  //     }
  //   }
  //   return counts;
  // }, [availablePartsBase, sourceGroups]);

  // Now produce a sorted list: keep "All" first, then other parts sorted by count desc, tie-break by name asc
  //
  // Robust part discovery + counts
  // - collects parts from: parts prop, group._parts, group.partId
  // - normalizes keys consistently
  // - produces `availableParts` (Array) and `countsByPart` (Map)
  //
  // Robust part discovery + counts — resolve against `parts` prop and skip raw ids
  const { availableParts, countsByPart } = useMemo(() => {
    const partMap = new Map(); // norm -> { slug, name, count }

    // build lookups from parts prop
    const bySlug = new Map();
    const byId = new Map();
    const byName = new Map();
    if (Array.isArray(parts)) {
      for (const p of parts) {
        if (!p) continue;
        // ensure slug and name exist
        const slug = p.slug || p.id || p._id || p.name;
        const name = p.name || p.slug || String(p.id || p._id || '');
        const norm = normalizeKey(slug || name);
        if (!norm) continue;
        bySlug.set(normalizeKey(p.slug || ''), { slug: p.slug || slug, name });
        if (p._id || p.id) byId.set(String(p._id || p.id), { slug: p.slug || slug, name });
        byName.set(normalizeKey(name), { slug: p.slug || slug, name });

        // seed partMap with authoritative entries
        if (!partMap.has(norm)) partMap.set(norm, { slug: p.slug || slug, name, count: 0 });
      }
    }

    // helper: try to resolve a candidate (slug/id/name) to {slug,name}
    function resolveCandidate(value) {
      if (!value && value !== 0) return null;
      const s = String(value).trim();
      if (!s) return null;
      const norm = normalizeKey(s);

      // try slug lookup
      const fromSlug = bySlug.get(norm);
      if (fromSlug) return fromSlug;

      // try id lookup (raw match)
      const fromId = byId.get(s);
      if (fromId) return fromId;

      // try name lookup
      const fromName = byName.get(norm);
      if (fromName) return fromName;

      // not resolvable
      return null;
    }

    // seed from groups (use resolved parts only — skip unknown ids)
    for (const g of sourceGroups || []) {
      if (!g) continue;
      if (Array.isArray(g._parts) && g._parts.length) {
        for (const pp of g._parts) {
          if (!pp) continue;
          // prefer explicit name/slug from the group item, but resolve against parts list if possible
          const candidate = pp.slug || pp.name;
          const resolved = resolveCandidate(candidate) || (pp.name ? { slug: pp.slug || pp.name, name: pp.name } : null);
          if (!resolved) continue; // skip unknown raw ids
          const norm = normalizeKey(resolved.slug || resolved.name);
          if (!norm) continue;
          if (!partMap.has(norm)) partMap.set(norm, { slug: resolved.slug, name: resolved.name, count: 0 });
        }
      }
      if (g.partId) {
        const resolved = resolveCandidate(g.partId);
        if (!resolved) continue; // skip showing raw partId values
        const norm = normalizeKey(resolved.slug || resolved.name);
        if (!norm) continue;
        if (!partMap.has(norm)) partMap.set(norm, { slug: resolved.slug, name: resolved.name, count: 0 });
      }
    }

    // Count groups per part (avoid double counting same group for same part)
    for (const g of sourceGroups || []) {
      if (!g) continue;
      const seenThisGroup = new Set();

      if (Array.isArray(g._parts) && g._parts.length) {
        for (const pp of g._parts) {
          const candidate = pp?.slug || pp?.name;
          const resolved = resolveCandidate(candidate) || (pp?.name ? { slug: pp.slug || pp.name, name: pp.name } : null);
          if (!resolved) continue;
          const norm = normalizeKey(resolved.slug || resolved.name);
          if (!norm) continue;
          if (partMap.has(norm) && !seenThisGroup.has(norm)) {
            partMap.get(norm).count += 1;
            seenThisGroup.add(norm);
          }
        }
      } else if (g.partId) {
        const resolved = resolveCandidate(g.partId);
        if (!resolved) continue;
        const norm = normalizeKey(resolved.slug || resolved.name);
        if (!norm) continue;
        if (partMap.has(norm) && !seenThisGroup.has(norm)) {
          partMap.get(norm).count += 1;
          seenThisGroup.add(norm);
        }
      }
    }

    // build availableParts array (All first)
    const allEntry = { slug: '', name: 'All', count: (sourceGroups && sourceGroups.length) || 0 };
    const rest = Array.from(partMap.values()).map((v) => ({ slug: v.slug, name: v.name, count: v.count }));

    rest.sort((a, b) => {
      if ((b.count || 0) !== (a.count || 0)) return (b.count || 0) - (a.count || 0);
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return 0;
    });

    // create counts map keyed by slug (fallback to name)
    const countsMap = new Map();
    countsMap.set('', allEntry.count);
    for (const p of rest) countsMap.set(p.slug || p.name || '', p.count || 0);

    console.debug('Results debug (resolved parts):', {
      sourceGroupsLength: (sourceGroups && sourceGroups.length) || 0,
      sampleGroup: (sourceGroups && sourceGroups[0]) || null,
      availableParts: [allEntry, ...rest].slice(0, 30),
      counts: Array.from(countsMap.entries()).slice(0, 30),
    });

    return { availableParts: [allEntry, ...rest], countsByPart: countsMap };
  }, [parts, sourceGroups]);



  // displayed groups filtered by activeSlug — still use the `groups` prop for display
  const displayedGroups = useMemo(() => {
    if (!activeSlug) return groups;
    return groups.filter((g) => {
      if (g && Array.isArray(g._parts) && g._parts.length) {
        return g._parts.some((p) => normalizeKey(p?.slug || p?.name || '') === normalizeKey(activeSlug));
      }
      if (g && g.partId) return normalizeKey(g.partId) === normalizeKey(activeSlug);
      return false;
    });
  }, [groups, activeSlug]);

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

  // replace the old groupPartsLabel with this
  function groupPartsLabel(g) {
    // prefer explicit _parts on the group
    if (g && Array.isArray(g._parts) && g._parts.length) {
      return g._parts.map((p) => p.name || p.slug).filter(Boolean).join(', ');
    }

    // if parent provided a selectedPart (e.g. when user filtered), show that
    if (selectedPart) return selectedPart.name;

    // fallback: try to resolve g.partId against the known parts list
    if (g && g.partId) {
      const match =
        parts.find(
          (p) =>
            String(p.slug) === String(g.partId) ||
            String(p._id) === String(g.partId) ||
            String(p.id) === String(g.partId) ||
            String(p.name) === String(g.partId)
        ) || null;
      return (match && (match.name || match.slug)) || String(g.partId);
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

                {/* part badges */}
                {/* part badges */}
                {/* <div className={styles.partBadges}>
                  {(
                    // prefer explicit _parts; otherwise try to synthesize from g.partId
                    (Array.isArray(g._parts) && g._parts.length
                      ? g._parts
                      : (g.partId
                        ? // synthesize a single-part array using parts[] lookup
                        [
                          (() => {
                            const match =
                              parts.find(
                                (p) =>
                                  String(p.slug) === String(g.partId) ||
                                  String(p._id) === String(g.partId) ||
                                  String(p.id) === String(g.partId) ||
                                  String(p.name) === String(g.partId)
                              ) || null;
                            return { slug: match?.slug || g.partId, name: match?.name || String(g.partId) };
                          })()
                        ]
                        : [])
                    )
                  ).map((p) => (
                    <button
                      key={p.slug || p.name}
                      className={styles.partBadge}
                      onClick={() => handleSelectPart(p.slug || '')}
                      title={`Show ${p.name}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div> */}


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
