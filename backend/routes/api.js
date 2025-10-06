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
  try {
    const q = (req.query.q || '').trim();
    const partSlug = (req.query.part || '').trim(); // optional part slug
    if (!q) return res.json({ devices: [], groups: [] });

    // find devices first
    const norm = normalize(q);
    let devices = await Device.find({ normalized: norm }).populate('brand','name').limit(10);
    if (!devices.length) {
      devices = await Device.find({ $text: { $search: q } }).limit(10).populate('brand','name');
    }

    const deviceIds = devices.map(d => d._id);
    let groups = [];

    if (partSlug) {
      // ensure part exists — if part was deleted, don't return groups
      const partDoc = await Part.findOne({ slug: partSlug });
      if (partDoc) {
        // support either single partId field or parts array in group schema
        const partFilter = { $or: [{ partId: partDoc._id }, { parts: partDoc._id }] };

        // if we have device matches, require group to include at least one of them
        const query = deviceIds.length
          ? { $and: [partFilter, { models: { $in: deviceIds } }] }
          : partFilter;

        groups = await CompatibilityGroup.find(query)
          .populate({ path: 'models', populate: { path: 'brand', select: 'name' } })
          .limit(50);
      } else {
        // partSlug provided but Part not found -> intentionally return no groups
        groups = [];
      }
    } else {
      // no part specified -> find groups that include any of the matched devices
      if (deviceIds.length) {
        groups = await CompatibilityGroup.find({ models: { $in: deviceIds } })
          .populate({ path: 'models', populate: { path: 'brand', select: 'name' } })
          .limit(50);
      }
    }

    return res.json({ devices, groups });
  } catch (err) {
    console.error('search error', err);
    return res.status(500).json({ error: 'Server error' });
  }
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
