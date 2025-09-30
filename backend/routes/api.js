// routes/api.js
const express = require('express');
const router = express.Router();
const normalize = require('../lib/normalize');

const Device = require('../models/Device');
const Part = require('../models/PartCategory');
const CompatibilityGroup = require('../models/CompatibilityGroup');
const Brand = require('../models/Brand');

// autocomplete devices
router.get('/devices/autocomplete', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const norm = normalize(q);
  // try normalized exact then text search
  const exact = await Device.find({ normalized: norm }).limit(10).populate('brand','name');
  if (exact.length) return res.json(exact);
  const fuzzy = await Device.find({ $text: { $search: q } }, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(10).populate('brand','name');
  res.json(fuzzy);
});

// get groups for a part slug
router.get('/parts/:partSlug/groups', async (req, res) => {
  const slug = req.params.partSlug;
  const part = await Part.findOne({ slug });
  if (!part) return res.status(404).json({ error: 'part not found' });
  const groups = await CompatibilityGroup.find({ partId: part._id }).populate({
    path: 'models', populate: { path: 'brand', select: 'name' }
  }).limit(200);
  res.json({ part, groups });
});

// search text (devices or groups)
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  const part = req.query.part; // optional part slug
  if (!q) return res.json({ devices: [], groups: [] });

  // find devices first
  const norm = normalize(q);
  let devices = await Device.find({ normalized: norm }).populate('brand','name').limit(10);
  if (!devices.length) {
    devices = await Device.find({ $text: { $search: q } }).limit(10).populate('brand','name');
  }

  // if part provided and we found at least one device, fetch groups
  let groups = [];
  if (part) {
    const partDoc = await Part.findOne({ slug: part });
    if (partDoc && devices.length) {
      const ids = devices.map(d => d._id);
      groups = await CompatibilityGroup.find({ partId: partDoc._id, models: { $in: ids } })
        .populate({ path: 'models', populate: { path: 'brand', select: 'name' } });
    }
  } else {
    // fallback: find groups by text inside models/aliases via lookup - heavier
    // we'll look up all groups that include devices matched above
    if (devices.length) {
      const ids = devices.map(d => d._id);
      groups = await CompatibilityGroup.find({ models: { $in: ids } })
        .populate({ path: 'models', populate: { path: 'brand', select: 'name' } })
        .limit(50);
    }
  }

  res.json({ devices, groups });
});

// compatibility check: part + comma-separated device slugs
router.get('/compat/check', async (req, res) => {
  const partSlug = req.query.part;
  const devices = (req.query.devices || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!partSlug || devices.length < 1) return res.status(400).json({ error: 'part and devices required' });

  const part = await Part.findOne({ slug: partSlug });
  if (!part) return res.status(404).json({ error: 'part not found' });

  // resolve device slugs to ids
  const deviceDocs = await Device.find({ slug: { $in: devices } });
  const ids = deviceDocs.map(d => d._id);
  if (!ids.length) return res.json({ compatible: false, sharedGroups: [] });

  const groups = await CompatibilityGroup.find({
    partId: part._id,
    models: { $all: ids }
  }).populate({ path: 'models', populate: { path: 'brand', select: 'name' } });

  res.json({ compatible: groups.length > 0, sharedGroups: groups });
});

module.exports = router;
