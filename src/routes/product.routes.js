// routes/product.routes.js
const express = require('express');
const { body, param } = require('express-validator');
const multer = require('multer');

const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductImages,
  // 👇 جديد
  exportProductsCSV,
  importProductsCSV,
} = require('../controllers/product.controller');

const { requireAuth, requireAdmin } = require('../middlewares/auth');
const validate = require('../middlewares/validate');

const router = express.Router();

// ===== Multer (in-memory) لرفع CSV =====
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ---------- Validation: create ----------
const productValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required and must be less than 200 characters'),

  body('slug')
    .trim()
    .isLength({ min: 1, max: 200 })
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),

  body('priceInFils')
    .toInt()
    .isInt({ min: 0 })
    .withMessage('Price must be a positive integer'),

  body('oldPriceInFils')
    .optional({ nullable: true })
    .customSanitizer(v => (v === '' ? null : v))
    .toInt()
    .custom((v, { req }) => {
      if (v == null) return true;
      const price = Number(req.body.priceInFils);
      if (Number.isNaN(price)) return true;
      return v > price;
    })
    .withMessage('oldPriceInFils must be greater than priceInFils'),

  body('stock')
    .optional()
    .toInt()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),

  body('category')
    .optional()
    .isMongoId()
    .withMessage('Category must be a valid MongoDB ObjectId'),

  body('status')
    .optional()
    .isIn(['draft', 'active', 'archived'])
    .withMessage('Status must be one of: draft, active, archived'),
];

// ---------- Validation: update (PATCH) ----------
const updateValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be less than 200 characters'),

  body('slug')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),

  body('priceInFils')
    .optional()
    .toInt()
    .isInt({ min: 0 })
    .withMessage('Price must be a positive integer'),

  body('oldPriceInFils')
    .optional({ nullable: true })
    .customSanitizer(v => (v === '' ? null : v))
    .custom((v) => v === null || /^\d+$/.test(String(v)))
    .withMessage('oldPriceInFils must be an integer or null')
    .custom((v, { req }) => {
      if (v === null) return true;
      const price = req.body.priceInFils;
      if (price == null) return true;
      return Number(v) > Number(price);
    })
    .withMessage('oldPriceInFils must be greater than priceInFils when both are provided')
    .customSanitizer(v => (v === null ? null : Number(v))),

  body('stock')
    .optional()
    .toInt()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),

  body('category')
    .optional()
    .isMongoId()
    .withMessage('Category must be a valid MongoDB ObjectId'),

  body('status')
    .optional()
    .isIn(['draft', 'active', 'archived'])
    .withMessage('Status must be one of: draft, active, archived'),
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid product ID')
];

// ===== CSV Routes (ضعها قبل /:idOrSlug) =====
router.get('/export.csv', requireAuth, requireAdmin, exportProductsCSV);
router.post('/import', requireAuth, requireAdmin, upload.single('file'), importProductsCSV);

// ===== Public routes =====
router.get('/', getProducts);
router.get('/:idOrSlug', getProduct);

// ===== Admin routes =====
router.post('/', requireAuth, requireAdmin, productValidation, validate, createProduct);
router.patch('/:id', requireAuth, requireAdmin, idValidation, updateValidation, validate, updateProduct);
router.delete('/:id', requireAuth, requireAdmin, idValidation, validate, deleteProduct);
router.patch('/:id/images', requireAuth, requireAdmin, idValidation, validate, updateProductImages);

module.exports = router;
