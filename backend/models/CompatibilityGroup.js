// models/CompatibilityGroup.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CompatibilityGroupSchema = new Schema({
  partId: { type: Schema.Types.ObjectId, ref: 'PartCategory', required: true, index: true },
  models: [{ type: Schema.Types.ObjectId, ref: 'Device', required: true }],
  note: String,
  source: String,
  tags: [{ type: String }],
  confidence: { type: Number, default: 1 }
}, { timestamps: true });

// index to search groups by part + model presence
CompatibilityGroupSchema.index({ partId: 1, models: 1 });

module.exports = mongoose.model('CompatibilityGroup', CompatibilityGroupSchema);
