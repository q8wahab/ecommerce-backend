const express = require('express');
const { upload, uploadImage, deleteImage } = require('../controllers/upload.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// Routes
router.post('/image', requireAuth, requireAdmin, upload.single('image'), uploadImage);
router.delete('/image', requireAuth, requireAdmin, deleteImage);

module.exports = router;

