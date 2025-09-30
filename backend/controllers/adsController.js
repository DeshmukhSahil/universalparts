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

module.exports = {
  getAdsForPlacement,
  createAd,
  recordImpression,
  recordClick
};
