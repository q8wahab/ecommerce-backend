const express = require('express');
const { body, param } = require('express-validator');
const { 
  getCategories, 
  createCategory, 
  updateCategory, 
  deleteCategory 
} = require('../controllers/category.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const validate = require('../middlewares/validate');

const router = express.Router();

// Validation rules
const categoryValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name is required and must be less than 100 characters'),
  body('slug')
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid category ID')
];

// Public routes
router.get('/', getCategories);

// Admin routes
router.post('/', requireAuth, requireAdmin, categoryValidation, validate, createCategory);
router.patch('/:id', requireAuth, requireAdmin, idValidation, categoryValidation, validate, updateCategory);
router.delete('/:id', requireAuth, requireAdmin, idValidation, validate, deleteCategory);

module.exports = router;

