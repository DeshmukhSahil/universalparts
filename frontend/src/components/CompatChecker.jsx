import React, { useState } from 'react';
import { checkCompat } from '../utils/api';
import styles from './CompatChecker.module.css';

/** small slugify helper: trims, lowercases, spaces -> -, removes extra non-word chars */
function slugify(s = '') {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')         // spaces -> dash
    .replace(/[^a-z0-9\-]/g, '')  // remove non-alphanum except dash
    .replace(/\-+/g, '-')         // collapse multiple dashes
    .replace(/^\-+|\-+$/g, '');   // trim leading/trailing dashes
}

export default function CompatChecker({ partSlug }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [error, setError] = useState(null);

  async function onCheck() {
    setError(null);
    setResult(null);

    const sA = slugify(a);
    if (!sA) return alert('Enter first device slug (e.g. realme-c20)');

    const sB = slugify(b);
    const slugs = [sA];
    if (sB) slugs.push(sB);

    // if parent passed empty string for "All", send undefined so backend can treat as all
    const partParam = partSlug ? partSlug : undefined;

    const payloadForLog = { part: partParam ?? '<all parts>', slugs };

    try {
      setLoading(true);
      console.debug('[CompatChecker] request', payloadForLog);
      const res = await checkCompat(partParam, slugs);
      console.debug('[CompatChecker] response', res);

      // Some backends may not return explicit `compatible` boolean.
      // Compute fallback: if sharedGroups array exists and has length > 0, treat as compatible.
      const computedCompatible =
        typeof (res && res.compatible) === 'boolean'
          ? res.compatible
          : Array.isArray(res && res.sharedGroups) && res.sharedGroups.length > 0;

      setResult({
        raw: res,
        compatible: !!computedCompatible,
      });
    } catch (err) {
      console.error('Compat check failed', err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <h4 className={styles.title}>Compatibility Checker</h4>

      <div className={styles.formRow}>
        <label className={styles.visuallyHidden} htmlFor="slug-a">Device A</label>
        <input
          id="slug-a"
          placeholder="device slug e.g. realme-c20"
          value={a}
          onChange={e => setA(e.target.value)}
          className={styles.input}
        />

        <label className={styles.visuallyHidden} htmlFor="slug-b">Device B</label>
        <input
          id="slug-b"
          placeholder="device slug e.g. realme-narzo-50i (optional)"
          value={b}
          onChange={e => setB(e.target.value)}
          className={styles.input}
        />

        <button onClick={onCheck} className={styles.button} disabled={loading}>
          {loading ? 'Checking…' : 'Check'}
        </button>
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
        <div className={styles.small}>Part: <strong>{partSlug || 'All'}</strong></div>
        <button
          type="button"
          className={`${styles.smallBtn}`}
          onClick={() => {
            // quick convenience: try checking across all parts even if partSlug is set
            // by calling check with undefined part (we just set local inputs to trigger)
            // We'll reuse onCheck but temporarily override partSlug by calling checkCompat directly.
            (async () => {
              const sA = slugify(a);
              if (!sA) return alert('Enter first device slug (e.g. realme-c20)');
              const sB = slugify(b);
              const slugs = [sA]; if (sB) slugs.push(sB);
              setLoading(true); setError(null); setResult(null);
              try {
                console.debug('[CompatChecker] request (all parts)', { part: '<all parts>', slugs });
                const res = await checkCompat(undefined, slugs);
                console.debug('[CompatChecker] response (all parts)', res);
                const computedCompatible = typeof (res && res.compatible) === 'boolean'
                  ? res.compatible
                  : Array.isArray(res && res.sharedGroups) && res.sharedGroups.length > 0;
                setResult({ raw: res, compatible: !!computedCompatible });
              } catch (err) {
                console.error(err);
                setError(err.message || String(err));
              } finally {
                setLoading(false);
              }
            })();
          }}
        >
          Check across all parts
        </button>

        <button type="button" className={styles.toggleDebug} onClick={() => setDebugOpen(s => !s)}>
          {debugOpen ? 'Hide debug' : 'Show debug'}
        </button>
      </div>

      {error && <div className={styles.err}>Error: {error}</div>}

      {result && (
        <div className={styles.result}>
          <div>Compatible: <strong className={result.compatible ? styles.yes : styles.no}>
            {result.compatible ? 'YES' : 'NO'}
          </strong></div>

          {/* try to show sharedGroups if present in raw response */}
          {result.raw?.sharedGroups?.length > 0 && (
            <div className={styles.shared}>
              <div className={styles.sharedTitle}>Shared Groups</div>
              <ul>
                {result.raw.sharedGroups.map(g => (
                  <li key={g._id || JSON.stringify(g)}>
                    {g.part?.name || g.partId || g.partSlug} — { (g.models || []).map(m => `${m.brand?.name || ''} ${m.name || m.slug}`).join(', ') }
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* helpful hint when NO */}
          {!result.compatible && (!result.raw?.sharedGroups || result.raw.sharedGroups.length === 0) && (
            <div className={styles.hint}>
              No shared compatibility groups found. Try checking across all parts or verify device slugs.
            </div>
          )}

          {debugOpen && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer' }}>Raw response (click to expand)</summary>
              <pre className={styles.pre}>{JSON.stringify(result.raw, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
