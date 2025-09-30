// models/Device.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DeviceSchema = new Schema({
  brand: { type: Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
  name: { type: String, required: true },           // user-friendly e.g. "C2"
  slug: { type: String, required: true, unique: true }, // "realme-c2"
  aliases: [{ type: String }],                       // ["oppo a1k"]
  normalized: { type: String, required: true, index: true }, // normalized for fast lookup
  meta: { type: Schema.Types.Mixed }
}, { timestamps: true });

// text index for fuzzy/autocomplete over name + aliases
DeviceSchema.index({ name: 'text', aliases: 'text' });

module.exports = mongoose.model('Device', DeviceSchema);
