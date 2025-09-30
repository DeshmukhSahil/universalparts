// routes/ads.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
// const { requireAdmin } = require('../middleware/requireAdmin'); // adjust path if needed
const {
  getAdsForPlacement,
  createAd,
  recordImpression,
  recordClick
} = require('../controllers/adsController');

const router = express.Router();

// Ensure upload directory exists (same path as server.js)
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'ads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const safe = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
    cb(null, safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB cap (tweak)
  fileFilter: (req, file, cb) => {
    // only allow images and videos
    if (/^image\/|^video\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'), false);
  }
});

// Admin upload route (protected)
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const publicUrl = `/uploads/ads/${req.file.filename}`;
  res.json({ url: publicUrl, filename: req.file.filename });
});

// Ads public API
router.get('/', getAdsForPlacement);
router.post('/',createAd);

// Tracking endpoints
router.post('/:id/impression', recordImpression);
router.post('/:id/click', recordClick);

module.exports = router;
