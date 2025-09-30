// models/PartCategory.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PartCategorySchema = new Schema({
  name: { type: String, required: true, unique: true }, // "Universal Frame List"
  slug: { type: String, required: true, unique: true }, // "frame"
  description: { type: String },
  meta: { type: Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('PartCategory', PartCategorySchema);
