// src/utils/adminApi.js
// Uses same API_BASE mechanism as utils/api.js
const API_BASE = (process.env.REACT_APP_API_BASE || '').replace(/\/+$/, '');

async function adminFetch(path, opts = {}) {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${safePath}`;
  const res = await fetch(url, opts);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(body?.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// Brands
export const createBrand = (name) =>
  adminFetch(`/api/admin/brand`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name }) });

// Device
export const createDevice = ({ brandSlug, brandName, name, aliases = [] }) =>
  adminFetch(`/api/admin/device`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ brandSlug, brandName, name, aliases }) });

// Part
export const createPart = (name, description = '') =>
  adminFetch(`/api/admin/part`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, description }) });

// Group
export const createGroup = ({ partSlug, partId, models = [], note = '', source = 'admin' }) =>
  adminFetch(`/api/admin/group`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ partSlug, partId, models, note, source }) });

// Add alias
export const addAlias = (deviceSlug, alias) =>
  adminFetch(`/api/admin/device/${encodeURIComponent(deviceSlug)}/alias`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ alias }) });

// Utility: fetch parts, devices, brands for selects (use existing public endpoints where possible)
export async function fetchParts() {
  // we don't have admin list endpoint; fetch known part slugs by trying a few or add a simple endpoint later.
  // For now, try popular slugs or return empty and let the UI use creation flow.
  return adminFetch('/api/parts') // if you create this endpoint later; otherwise use manual entry
    .catch(() => []);
}

export async function fetchAdminParts() {
  // we don't have admin list endpoint; fetch known part slugs by trying a few or add a simple endpoint later.
  // For now, try popular slugs or return empty and let the UI use creation flow.
  return adminFetch('/api/admin/parts') // if you create this endpoint later; otherwise use manual entry
    .catch(() => []);
}

export async function fetchDeviceByQuery(q) {
  const res = await fetch(`${API_BASE || ''}/api/devices/autocomplete?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return res.json();
}
