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

// Validation rules
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
    .isInt({ min: 0 })
    .withMessage('Price must be a positive integer'),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  body('category')
    .optional()
    .isMongoId()
    .withMessage('Category must be a valid MongoDB ObjectId')
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid product ID')
];

// Public routes
router.get('/', getProducts);
router.get('/:idOrSlug', getProduct);
// Add this route if it doesn't exist



// Admin routes
router.post('/', requireAuth, requireAdmin, productValidation, validate, createProduct);
router.patch('/:id', requireAuth, requireAdmin, idValidation, validate, updateProduct);
router.delete('/:id', requireAuth, requireAdmin, idValidation, validate, deleteProduct);
router.patch('/:id/images', requireAuth, requireAdmin, idValidation, validate, updateProductImages);

module.exports = router;

