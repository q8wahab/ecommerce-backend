// routes/product.routes.js
const express = require('express');
const { body, param } = require('express-validator');
const { 
  getProducts, 
  getProduct, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  updateProductImages 
} = require('../controllers/product.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const validate = require('../middlewares/validate');

const router = express.Router();

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
    .toInt() // ✅ نحول لنمبر
    .isInt({ min: 0 })
    .withMessage('Price must be a positive integer'),

  // ✅ oldPriceInFils اختياري؛ لو موجود لازم ≥0 و > priceInFils
  body('oldPriceInFils')
    .optional({ nullable: true })
    .customSanitizer(v => (v === '' ? null : v))  // "" => null
    .toInt() // يحول (لو مو null)
    .custom((v, { req }) => {
      if (v == null) return true; // null أو undefined = بدون خصم
      const price = Number(req.body.priceInFils);
      if (Number.isNaN(price)) return true; // لو ما وصل price هنا (نادرًا)
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
    .customSanitizer(v => (v === '' ? null : v)) // "" => null
    .custom((v) => v === null || /^\d+$/.test(String(v)))
    .withMessage('oldPriceInFils must be an integer or null')
    .custom((v, { req }) => {
      // لو v === null → السماح بإلغاء الخصم
      if (v === null) return true;
      const price = req.body.priceInFils;
      // لو ما أُرسل priceInFils مع الطلب، نخلي التحقق في الكنترولر
      if (price == null) return true;
      return Number(v) > Number(price);
    })
    .withMessage('oldPriceInFils must be greater than priceInFils when both are provided')
    .customSanitizer(v => (v === null ? null : Number(v))), // نخزنه كرقم فعليًا

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

// Public routes
router.get('/', getProducts);
router.get('/:idOrSlug', getProduct);

// Admin routes
router.post('/', requireAuth, requireAdmin, productValidation, validate, createProduct);
router.patch('/:id', requireAuth, requireAdmin, idValidation, updateValidation, validate, updateProduct);
router.delete('/:id', requireAuth, requireAdmin, idValidation, validate, deleteProduct);
router.patch('/:id/images', requireAuth, requireAdmin, idValidation, validate, updateProductImages);

module.exports = router;
