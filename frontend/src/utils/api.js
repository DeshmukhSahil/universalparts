// src/utils/api.js
// Single place to control backend base URL.
// If REACT_APP_API_BASE is not set, we use '' so relative URLs (and CRA proxy) still work.

const API_BASE = (process.env.REACT_APP_API_BASE || '').replace(/\/+$/, ''); // remove trailing slash

async function apiFetch(path, opts = {}) {
  // ensure path starts with a slash
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${safePath}`;
  const res = await fetch(url, opts);
  if (!res.ok) {
    // try to return json error if available, otherwise throw generic
    let body;
    try { body = await res.json(); } catch (e) { /* ignore */ }
    const err = new Error(body?.message || `Request failed: ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}

export async function autocomplete(q) {
  if (!q) return [];
  try {
    return await apiFetch(`/api/devices/autocomplete?q=${encodeURIComponent(q)}`);
  } catch (e) {
    console.error('autocomplete error', e);
    return [];
  }
}

export async function search(q, part) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (part) params.set('part', part);
  try {
    return await apiFetch(`/api/search?${params.toString()}`);
  } catch (e) {
    console.error('search error', e);
    return { devices: [], groups: [] };
  }
}

export async function getGroups(partSlug) {
  try {
    return await apiFetch(`/api/parts/${encodeURIComponent(partSlug)}/groups`);
  } catch (e) {
    console.error('getGroups error', e);
    return { part: null, groups: [] };
  }
}

export async function checkCompat(part, slugsArray) {
  const devices = slugsArray.join(',');
  try {
    return await apiFetch(`/api/compat/check?part=${encodeURIComponent(part)}&devices=${encodeURIComponent(devices)}`);
  } catch (e) {
    console.error('checkCompat error', e);
    return { compatible: false, sharedGroups: [] };
  }
}
