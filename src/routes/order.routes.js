const express = require('express');
const { body, param } = require('express-validator');
const { createOrder, getOrder } = require('../controllers/order.controller');
const { requireAuth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');

const router = express.Router();

// Validation rules
const orderValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Items array is required and must not be empty'),
  body('items.*.productId')
    .isMongoId()
    .withMessage('Product ID must be a valid MongoDB ObjectId'),
  body('items.*.title')
    .trim()
    .notEmpty()
    .withMessage('Item title is required'),
  body('items.*.priceInFils')
    .isInt({ min: 0 })
    .withMessage('Item price must be a positive integer'),
  body('items.*.qty')
    .isInt({ min: 1 })
    .withMessage('Item quantity must be at least 1'),
  body('shippingInFils')
    .isInt({ min: 0 })
    .withMessage('Shipping cost must be a non-negative integer'),
  body('address.firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required'),
  body('address.lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required'),
  body('address.line1')
    .trim()
    .notEmpty()
    .withMessage('Address line 1 is required'),
  body('address.country')
    .trim()
    .notEmpty()
    .withMessage('Country is required'),
  body('address.zip')
    .trim()
    .notEmpty()
    .withMessage('ZIP code is required')
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid order ID')
];

// Routes
router.post('/', orderValidation, validate, createOrder);
router.get('/:id', requireAuth, idValidation, validate, getOrder);

module.exports = router;

