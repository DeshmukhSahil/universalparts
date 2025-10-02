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
const { authMiddleware } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');

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
router.post('/upload', authMiddleware, adminOnly, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const publicUrl = `/uploads/ads/${req.file.filename}`;
  res.json({ url: publicUrl, filename: req.file.filename });
});

// Ads public API
router.get('/', getAdsForPlacement);
router.post('/', authMiddleware, adminOnly, createAd);

// Tracking endpoints
router.post('/:id/impression', recordImpression);
router.post('/:id/click', recordClick);

router.delete('/:id', authMiddleware, adminOnly,  async (req, res) => {
  try {
    const { id } = req.params;
    // delegate to controller (keeps routes thin)
    const { deleteAd } = require('../controllers/adsController');
    const result = await deleteAd(id);
    if (!result) return res.status(404).json({ error: 'Ad not found' });
    res.status(204).end();
  } catch (err) {
    console.error('delete ad error', err);
    res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
