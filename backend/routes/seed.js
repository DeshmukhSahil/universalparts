// routes/seed.js
const express = require('express');
const router = express.Router();

const Brand = require('../models/Brand');
const Device = require('../models/Device');
const PartCategory = require('../models/PartCategory');
const CompatibilityGroup = require('../models/CompatibilityGroup');
const normalize = require('../lib/normalize');

// sample lines (from your message) for Universal Frame
const sampleLines = [
  "Realme c2 = Oppo a1k",
  "Realme c20 = Realme c11 2021 = Realme Narzo 50i",
  "Realme 5 = Realme 5s",
  "Realme c25 = Realme c25s",
  "Realme 5i = Realme c3",
  "Realme Narzo 30a = Realme narzo 50a",
  "Oppo a15 = Oppo a15s = Oppo a16k",
  "Realme c30 = Realme c33 = Realme c30s",
  "Realme 8s 5g = Realme 8 5g",
  "Realme 9i = Realme a76 4g = Realme a96 4g",
  "Oppo a33 = Oppo a53",
  "Realme 8 4g = Realme 8 pro",
  "Oppo a93 5g = Oppo a74 5g = Oppo reno 4f"
];

async function upsertBrand(name) {
  const slug = normalize(name).replace(/\s+/g, '-');
  let b = await Brand.findOne({ slug });
  if (!b) b = await Brand.create({ name, slug });
  return b;
}

async function upsertDevice(brandDoc, rawName) {
  // rawName might contain brand word; remove brand token if present
  const name = rawName.trim();
  const slug = normalize(`${brandDoc.name} ${name}`).replace(/\s+/g, '-');
  let d = await Device.findOne({ slug });
  if (d) return d;
  const normalized = normalize(`${brandDoc.name} ${name}`);
  d = await Device.create({
    brand: brandDoc._id,
    name,
    slug,
    aliases: [], // will add later if needed
    normalized
  });
  return d;
}

router.post('/', async (req, res) => {
  try {
    // ensure part exists
    let part = await PartCategory.findOne({ slug: 'frame' });
    if (!part) part = await PartCategory.create({ name: 'Universal Frame List', slug: 'frame' });

    for (const line of sampleLines) {
      // split tokens by = or +
      const tokens = line.split(/=|\+/).map(t => t.trim()).filter(Boolean);
      const modelIds = [];

      // handle each token, determine brand and model
      for (const token of tokens) {
        // attempt to split first word as brand (best-effort)
        const parts = token.split(/\s+/);
        let brandName = parts[0]; // naive: first token as brand
        // but if token has 'Realme' or 'Oppo' or 'Poco' detect common brands
        // for reliability, we can use a list or assume the token contains brand-like first word.
        // Use more robust heuristics if you have brand list.
        brandName = parts[0]; // keep simple
        const modelName = parts.slice(1).join(' ') || parts[0]; // fallback

        // try to upsert brand by checking if brand exists, else create
        // Slight improvement: check known brands list
        const knownBrands = ['realme','oppo','poco','samsung','iphone','vivo','oneplus'];
        let chosenBrand = brandName;
        if (!knownBrands.includes(normalize(brandName))) {
          // If first token isn't a known brand, try guess by scanning for known brand tokens
          const found = parts.find(p => knownBrands.includes(normalize(p)));
          if (found) {
            chosenBrand = found;
          } else {
            // fallback: use first token as brand
            chosenBrand = brandName;
          }
        }

        const brandDoc = await upsertBrand(capitalize(chosenBrand));
        // compute device rawName: if modelName is empty, use entire token minus brand
        const rawModelName = modelName || token.replace(new RegExp(chosenBrand, 'i'), '').trim() || token;
        const device = await upsertDevice(brandDoc, rawModelName);
        modelIds.push(device._id);
      }

      // create compatibility group for this line if not exists (same set)
      // check if a group with same partId and same models set exists
      const existing = await CompatibilityGroup.findOne({
        partId: part._id,
        models: { $all: modelIds, $size: modelIds.length }
      });

      if (!existing) {
        await CompatibilityGroup.create({
          partId: part._id,
          models: modelIds,
          source: 'seed_readme_2025',
        });
      }
    }

    res.json({ ok: true, message: 'Seed completed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

module.exports = router;
