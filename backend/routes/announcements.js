const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const { authMiddleware } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');

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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE (temporarily public — no auth)
router.post('/', authMiddleware, adminOnly,  async (req, res) => {
  try {
    const { title, message, pinned, startsAt, expiresAt, active } = req.body;
    const ann = new Announcement({
      title,
      message,
      pinned: !!pinned,
      startsAt: startsAt || Date.now(),
      expiresAt: expiresAt || null,
      active: active !== false
    });

    await ann.save();

    // NOTE: socket.io emits removed (not using socket.io)

    res.status(201).json(ann);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE (temporarily public — no auth)
router.put('/:id', authMiddleware, adminOnly,  async (req, res) => {
  try {
    const update = { ...req.body, updatedAt: Date.now() };
    const ann = await Announcement.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!ann) return res.status(404).json({ error: 'Not found' });

    // NOTE: socket.io emits removed (not using socket.io)

    res.json(ann);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE (soft delete: set active=false) (temporarily public — no auth)
router.delete('/:id', authMiddleware, adminOnly,  async (req, res) => {
  try {
    const ann = await Announcement.findByIdAndUpdate(
      req.params.id,
      { active: false, updatedAt: Date.now() },
      { new: true }
    );
    if (!ann) return res.status(404).json({ error: 'Not found' });

    // NOTE: socket.io emits removed (not using socket.io)

    res.json({ message: 'Soft-deleted', ann });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PERMANENT DELETE (hard delete) — permanently removes announcement from DB
// Usage: DELETE /api/announcements/:id/permanent
router.delete('/:id/permanent', authMiddleware, adminOnly,  async (req, res) => {
  try {
    const ann = await Announcement.findByIdAndDelete(req.params.id);
    if (!ann) return res.status(404).json({ error: 'Not found' });

    // If you need to do cleanup (files, linked resources), do it here.

    res.json({ message: 'Permanently deleted', ann });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
