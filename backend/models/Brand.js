// models/Brand.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BrandSchema = new Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  meta: { type: Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('Brand', BrandSchema);
