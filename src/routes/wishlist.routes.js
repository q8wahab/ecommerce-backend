const express = require('express');
const { body } = require('express-validator');
const { getWishlist, toggleWishlist } = require('../controllers/wishlist.controller');
const { requireAuth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');

const router = express.Router();

// Validation rules
const toggleValidation = [
  body('productId')
    .isMongoId()
    .withMessage('Product ID must be a valid MongoDB ObjectId')
];

// Routes
router.get('/me/wishlist', requireAuth, getWishlist);
router.post('/me/wishlist/toggle', requireAuth, toggleValidation, validate, toggleWishlist);

module.exports = router;

