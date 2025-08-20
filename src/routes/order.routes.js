// routes/order.routes.js
const express = require('express');
const { body, param } = require('express-validator');
const { createOrder, getOrder } = require('../controllers/order.controller');
const { requireAuth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');

const router = express.Router();

/**
 * التحقق لطلب إنشاء الأوردر:
 * - لا نثق بأي أسعار قادمة من الفرونت — الكنترولر يحسب الأسعار من الداتابيس
 * - نسمح بـ product أو productId للرجعية
 */
const createOrderValidation = [
  // customer
  body('customer.name')
    .trim().notEmpty().withMessage('Customer name is required'),
  body('customer.phone')
    .exists().withMessage('Phone is required')
    .bail()
    .matches(/^\d{8}$/).withMessage('Phone must be exactly 8 digits'),
  body('customer.email')
    .optional({ nullable: true })
    .isEmail().withMessage('Invalid email')
    .bail()
    .normalizeEmail(),

  // shippingAddress
  body('shippingAddress.area')
    .trim().notEmpty().withMessage('Area is required'),
  body('shippingAddress.block')
    .trim().notEmpty().withMessage('Block is required'),
  body('shippingAddress.street')
    .trim().notEmpty().withMessage('Street is required'),
  body('shippingAddress.avenue')
    .optional({ nullable: true }).trim(),
  body('shippingAddress.houseNo')
    .trim().notEmpty().withMessage('House number is required'),
  body('shippingAddress.notes')
    .optional({ nullable: true }).trim(),

  // items
  body('items')
    .isArray({ min: 1 }).withMessage('Items array is required and must not be empty'),

  // ندعم product أو productId
  body('items.*.product')
    .optional({ nullable: true })
    .isMongoId().withMessage('items.*.product must be a valid MongoDB ObjectId'),
  body('items.*.productId')
    .optional({ nullable: true })
    .isMongoId().withMessage('items.*.productId must be a valid MongoDB ObjectId'),

  body('items.*.qty')
    .isInt({ min: 1 }).withMessage('Each item qty must be at least 1'),

  // تأكيد وجود أحد الحقلين product أو productId لكل عنصر
  body('items').custom((items) => {
    if (!Array.isArray(items)) return false;
    for (const it of items) {
      if (!it || (!it.product && !it.productId)) {
        throw new Error('Each item must include product or productId');
      }
    }
    return true;
  }),
];

// POST /api/orders  (ضيوف مسموح)
router.post('/', createOrderValidation, validate, createOrder);

// GET /api/orders/:id (يتطلب تسجيل دخول؛ الكنترولر يتحقق من الملكية/الأدمن)
router.get('/:id',
  requireAuth,
  [param('id').isMongoId().withMessage('Invalid order ID')],
  validate,
  getOrder
);

module.exports = router;
