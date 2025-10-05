import React, { useEffect, useRef, useState } from 'react';
import { autocomplete } from '../utils/api';
import styles from './SearchBar.module.css';

/**
 * Props:
 *  - onSelect(device)
 *  - parts: [{slug, name}, ...]
 *  - part: selected part slug
 *  - onPartChange(slug)
 */
export default function SearchBar({
  onSelect,
  parts = [],
  part,
  onPartChange = () => {},
}) {
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [loading, setLoading] = useState(false);

  // tokens (guaranteed not to collide with real slugs)
  const PLACEHOLDER = '__SELECT_PART_PLACEHOLDER__';
  const ALL = '__ALL_PARTS__';

  // ensure placeholder shows on initial mount
  const firstRenderRef = useRef(true);
  const [localPart, setLocalPart] = useState(PLACEHOLDER);

  // after the first render, accept parent updates (if parent passes a non-empty slug).
  // This effect intentionally DOES NOT override the placeholder on the very first paint.
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      // keep placeholder on initial mount, even if parent passed something
      return;
    }
    // subsequent updates from parent: adopt a non-empty slug, or map '' to ALL
    if (part != null) {
      if (part === '') {
        setLocalPart(ALL);
      } else {
        setLocalPart(part);
      }
    }
  }, [part]);

  // helper to map internal tokens back to what parent expects
  function mapLocalToParent(val) {
    if (val === PLACEHOLDER) return ''; // placeholder -> no selection
    if (val === ALL) return ''; // All parts maps to ''
    return val;
  }

  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const itemsRef = useRef({}); // refs for suggestion items
  const deb = useRef(null);

  // fetch suggestions (debounced)
  useEffect(() => {
    clearTimeout(deb.current);
    if (!q) {
      setSuggestions([]);
      setOpen(false);
      setHighlight(-1);
      setLoading(false);
      return;
    }
    setLoading(true);
    deb.current = setTimeout(async () => {
      try {
        const res = await autocomplete(q);
        setSuggestions(res || []);
        setOpen(true);
        setHighlight(-1);
      } catch (err) {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(deb.current);
  }, [q]);

  // close on outside click
  useEffect(() => {
    function onDoc(e) {
      if (!wrapperRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // keyboard nav
  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open && suggestions.length) setOpen(true);
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && highlight >= 0 && suggestions[highlight]) {
        e.preventDefault();
        choose(suggestions[highlight]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  // scroll highlighted into view
  useEffect(() => {
    const el = itemsRef.current[highlight];
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlight]);

  function choose(item) {
    onSelect(item);
    setQ('');
    setSuggestions([]);
    setOpen(false);
    setHighlight(-1);
    inputRef.current?.blur();
  }

  function clearInput() {
    setQ('');
    setSuggestions([]);
    setOpen(false);
    setHighlight(-1);
    inputRef.current?.focus();
  }

  return (
    <div className={styles.searchContainer} ref={wrapperRef}>
      <div className={styles.searchPill}>
        {/* magnifier */}
        <div className={styles.leftIcon} aria-hidden>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 21l-4.35-4.35" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <input
          id="device-search"
          ref={inputRef}
          className={styles.searchInput}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search devices and get compatibilities"
          onKeyDown={onKeyDown}
          aria-autocomplete="list"
          aria-controls="search-suggestions"
          aria-expanded={open}
          role="combobox"
          aria-activedescendant={highlight >= 0 && suggestions[highlight] ? `sug-${suggestions[highlight]._id}` : undefined}
          onFocus={() => { if (suggestions.length) setOpen(true); }}
        />

        {/* clear button */}
        {q && (
          <button type="button" aria-label="Clear search" className={styles.clearBtn} onClick={clearInput}>
            ×
          </button>
        )}

        {/* inline part select (right inside pill) */}
        <div className={styles.partContainer}>
          <label htmlFor="part-select" className={styles.visuallyHidden}>Filter by part</label>

          <select
            id="part-select"
            value={localPart}
            onChange={(e) => {
              const val = e.target.value;
              setLocalPart(val);
              onPartChange(mapLocalToParent(val));
            }}
            className={styles.partSelect}
            aria-label="Filter by part"
            style={{ color: 'cornflowerblue' }}
          >
            {/* placeholder displayed by default (disabled so user must pick real entry or All parts) */}
            <option value={PLACEHOLDER} disabled>
              Select a Part
            </option>

            {/* explicit "All parts" option (maps to '') */}
            <option value={ALL}>All parts</option>

            {parts.map((p) => (
              <option key={p.slug} value={p.slug}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* suggestions dropdown */}
      {open && (
        <div className={styles.dropdownWrapper} role="listbox" id="search-suggestions">
          {suggestions.length === 0 ? (
            <div className={styles.empty}>No suggestions</div>
          ) : (
            <ul className={styles.suggestionsList}>
              {suggestions.map((s, idx) => (
                <li
                  key={s._id}
                  id={`sug-${s._id}`}
                  role="option"
                  aria-selected={highlight === idx}
                  ref={(el) => (itemsRef.current[idx] = el)}
                  className={`${styles.suggestionItem} ${highlight === idx ? styles.active : ''}`}
                  onMouseEnter={() => setHighlight(idx)}
                  onMouseDown={(e) => e.preventDefault()} // keep input focus
                  onClick={() => choose(s)}
                >
                  <div className={styles.brandRow}>
                    {/* <span className={styles.brandName}>{s.brand?.name || ''}</span> */}
                    <span className={styles.modelName}>{s.name}</span>
                  </div>
                  {s.aliases?.length ? <div className={styles.alias}>{s.aliases[0]}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
