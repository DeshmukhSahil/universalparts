const mongoose = require('mongoose');


const TargetingSchema = new mongoose.Schema({
  devices: [String], // e.g. ["mobile","desktop"]
  parts: [String],   // e.g. ["brake-pad","oil-filter"]
  countries: [String],
}, { _id: false });

const AdSchema = new mongoose.Schema({
  title: { type: String },
  type: { type: String, enum: ["image","html","video"], default: "image" },
  imageUrl: { type: String },     // e.g. /uploads/ads/filename.jpg or external URL
  html: { type: String },         // sanitized server-side (optional)
  targetUrl: { type: String },    // click-through
  placement: { type: String, default: "header" }, // header, results, home, etc.
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  active: { type: Boolean, default: true },
  weight: { type: Number, default: 1 },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  targeting: { type: TargetingSchema, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

module.exports = mongoose.model('Ad', AdSchema);
