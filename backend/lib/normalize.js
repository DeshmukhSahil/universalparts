// lib/normalize.js
function normalize(s) {
  if (!s) return '';
  return s.toString()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
module.exports = normalize;
