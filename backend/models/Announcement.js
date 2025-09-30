// models/Announcement.js
const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },          // e.g. "Happy Diwali"
  message: { type: String, required: true },        // body text / html allowed (sanitize if HTML)
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  pinned: { type: Boolean, default: false },       // show on top
  startsAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },        // optional expiry
  active: { type: Boolean, default: true },       // admin can deactivate
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);
