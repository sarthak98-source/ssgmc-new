/**
 * backend/routes/arOverlay.js
 *
 * REST endpoints for uploading & serving AR overlay images.
 *
 * Mounted in server.js:
 *   const arOverlayRoutes = require('./routes/arOverlay');
 *   app.use('/api/ar', arOverlayRoutes);
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { getPool } = require('../config/db');

const router = express.Router();

// ─── Storage setup ────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../uploads/ar-overlays');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `ar_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB (GLB models can be larger)
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();

    const isImage = /^image\/(png|jpeg|webp)$/.test(file.mimetype);
    const isGltf =
      ext === '.glb' ||
      ext === '.gltf' ||
      /^model\/gltf-(binary|json)$/.test(file.mimetype) ||
      file.mimetype === 'model/gltf+json' ||
      file.mimetype === 'application/octet-stream';

    const ok = isImage || isGltf;
    cb(ok ? null : new Error('Only PNG/JPG/WebP/GLB/GLTF allowed'), ok);
  },
});

// ─── POST /api/ar/overlay/:productId ─────────────────────────────────────────
// Upload an AR overlay image for a product.
// Expects multipart/form-data with field "overlay"
router.post('/overlay/:productId', upload.single('overlay'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const productId = req.params.productId;
    const overlayUrl = `/uploads/ar-overlays/${req.file.filename}`;

    const pool = getPool();
    await pool.execute('UPDATE products SET ar_overlay = ? WHERE id = ?', [overlayUrl, productId]);

    return res.json({ success: true, overlayUrl });
  } catch (err) {
    console.error('AR overlay upload error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/ar/overlay/:productId ───────────────────────────────────────
router.delete('/overlay/:productId', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT ar_overlay FROM products WHERE id = ?', [req.params.productId]);

    const overlayPath = rows?.[0]?.ar_overlay;
    if (overlayPath) {
      const relative = String(overlayPath).replace(/^\/+/, '');
      const filePath = path.join(__dirname, '..', relative);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.execute('UPDATE products SET ar_overlay = NULL WHERE id = ?', [req.params.productId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
