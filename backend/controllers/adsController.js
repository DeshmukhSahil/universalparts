// controllers/adsController.js
const Ad = require('../models/Ad'); // make sure your models/Ad.js uses module.exports
const mongoose = require('mongoose');

async function getAdsForPlacement(req, res) {
  try {
    const { placement = 'header', device, part, country } = req.query;
    const now = new Date();

    const match = {
      active: true,
      placement
    };

    match.$and = [
      { $or: [{ startDate: { $lte: now } }, { startDate: null }] },
      { $or: [{ endDate: { $gte: now } }, { endDate: null }] }
    ];

    const targets = [];
    if (device) targets.push({ 'targeting.devices': { $in: [device] } });
    if (part) targets.push({ 'targeting.parts': { $in: [part] } });
    if (country) targets.push({ 'targeting.countries': { $in: [country] } });

    if (targets.length) {
      match.$or = targets.concat([{ targeting: {} }]); // fallback to non-targeted
    }

    const ads = await Ad.find(match).lean().exec();
    ads.sort((a, b) => (b.weight || 1) - (a.weight || 1) || new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ ads });
  } catch (err) {
    console.error('getAdsForPlacement:', err);
    res.status(500).json({ error: 'server error' });
  }
}

async function createAd(req, res) {
  try {
    const payload = req.body;
    const ad = new Ad(payload);
    await ad.save();
    res.status(201).json(ad);
  } catch (err) {
    console.error('createAd error:', err);
    res.status(400).json({ error: err.message });
  }
}

async function recordImpression(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).end();
    await Ad.findByIdAndUpdate(id, { $inc: { impressions: 1 } }).exec();
    res.status(204).end();
  } catch (err) {
    console.error('recordImpression:', err);
    res.status(500).end();
  }
}

async function recordClick(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).end();
    await Ad.findByIdAndUpdate(id, { $inc: { clicks: 1 } }).exec();
    res.status(204).end();
  } catch (err) {
    console.error('recordClick:', err);
    res.status(500).end();
  }
}

async function deleteAd(id) {
  const Ad = require('../models/Ad');
  const mongoose = require('mongoose');

  if (!mongoose.Types.ObjectId.isValid(id)) return false;

  const ad = await Ad.findById(id).exec();
  if (!ad) return false;

  // If ad.imageUrl is a local path like "/uploads/ads/filename.jpg", delete the file.
  try {
    if (ad.imageUrl && typeof ad.imageUrl === 'string') {
      // Only delete when it's a local path (not an external CDN/http url)
      if (!/^https?:\/\//i.test(ad.imageUrl) && ad.imageUrl.startsWith('/uploads/ads/')) {
        // sanitize & resolve
        const filename = path.basename(ad.imageUrl);
        const filePath = path.join(UPLOAD_DIR, filename);

        // Extra check: ensure final path is inside UPLOAD_DIR (prevent path traversal)
        if (!filePath.startsWith(UPLOAD_DIR)) {
          console.warn('Refusing to delete file outside uploads dir:', filePath);
        } else {
          // attempt unlink, but don't fail entire op if unlink fails
          try {
            await fs.unlink(filePath);
          } catch (e) {
            // file may already be missing — log and continue
            console.warn('Could not remove ad file:', filePath, e.message);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error while attempting to remove ad file', err);
  }

  // remove DB document
  await Ad.findByIdAndDelete(id).exec();
  return true;
}

module.exports = {
  getAdsForPlacement,
  createAd,
  recordImpression,
  recordClick,
  deleteAd,
};
