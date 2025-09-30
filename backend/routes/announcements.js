const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');

// middleware: ensure authenticated, and isAdmin for POST/PUT/DELETE
const auth = require('../middleware/auth'); // sets req.user
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
};

// PUBLIC: get active announcements (sorted: pinned + newest)
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const anns = await Announcement.find({
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      startsAt: { $lte: now }
    })
      .sort({ pinned: -1, createdAt: -1 })
      .lean();
    res.json(anns);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN: create
router.post('/', async (req, res) => {
  try {
    const { title, message, pinned, startsAt, expiresAt, active } = req.body;
    const ann = new Announcement({
      title, message, pinned: !!pinned, startsAt: startsAt || Date.now(),
      expiresAt: expiresAt || null, active: active !== false, createdBy: req.user._id
    });
    await ann.save();

    // If using socket.io, emit creation (see server integration below)
    if (req.app.get('io')) req.app.get('io').emit('announcement:new', ann);

    res.status(201).json(ann);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN: update
router.put('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const update = { ...req.body, updatedAt: Date.now() };
    const ann = await Announcement.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!ann) return res.status(404).json({ error: 'Not found' });
    if (req.app.get('io')) req.app.get('io').emit('announcement:update', ann);
    res.json(ann);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN: delete (soft delete or permanent)
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    // soft delete: set active=false
    const ann = await Announcement.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (req.app.get('io')) req.app.get('io').emit('announcement:delete', { id: req.params.id });
    res.json({ message: 'Deleted', ann });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
