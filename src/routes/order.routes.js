const express = require('express');
const { body, param } = require('express-validator');
const { createOrder, getOrder, getInvoicePdf } = require('../controllers/order.controller'); // ✅ استيراد موحّد
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const Order = require('../models/Order'); // موديل الطلبات

const router = express.Router();

/* ==================== Helpers (للأدمن) ==================== */
function buildSort(query) {
  if (query.sort) {
    const s = String(query.sort);
    if (s.includes(':')) {
      const [field, dir] = s.split(':');
      return { [field]: /desc|-1/i.test(dir) ? -1 : 1 };
    }
    if (s.startsWith('-')) return { [s.slice(1)]: -1 };
    return { [s]: 1 };
  }
  if (query.sortBy) {
    return { [query.sortBy]: /desc|-1/i.test(query.order) ? -1 : 1 };
  }
  return { createdAt: -1 };
}

function parsePagination(q) {
  // page/limit
  if (q.page || q.limit) {
    const page = Math.max(1, parseInt(q.page || '1', 10));
    const limit = Math.max(1, parseInt(q.limit || '20', 10));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }
  // pageNumber/pageSize
  if (q.pageNumber || q.pageSize) {
    const page = Math.max(1, parseInt(q.pageNumber || '1', 10));
    const limit = Math.max(1, parseInt(q.pageSize || '20', 10));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }
  // offset/limit
  if (q.offset || q.limit) {
    const skip = Math.max(0, parseInt(q.offset || '0', 10));
    const limit = Math.max(1, parseInt(q.limit || '20', 10));
    const page = Math.floor(skip / limit) + 1;
    return { page, limit, skip };
  }
  // skip/take
  if (q.skip || q.take) {
    const skip = Math.max(0, parseInt(q.skip || '0', 10));
    const limit = Math.max(1, parseInt(q.take || '20', 10));
    const page = Math.floor(skip / limit) + 1;
    return { page, limit, skip };
  }
  return { page: 1, limit: 20, skip: 0 };
}

/**
 * التحقق لطلب إنشاء الأوردر:
 * - لا نثق بأي أسعار قادمة من الفرونت — الكنترولر يحسب الأسعار من الداتابيس
 * - نسمح بـ product أو productId للرجعية
 */
const createOrderValidation = [
  // customer
  body('customer.name').trim().notEmpty().withMessage('Customer name is required'),
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
  body('shippingAddress.area').trim().notEmpty().withMessage('Area is required'),
  body('shippingAddress.block').trim().notEmpty().withMessage('Block is required'),
  body('shippingAddress.street').trim().notEmpty().withMessage('Street is required'),
  body('shippingAddress.avenue').optional({ nullable: true }).trim(),
  body('shippingAddress.houseNo').trim().notEmpty().withMessage('House number is required'),
  body('shippingAddress.notes').optional({ nullable: true }).trim(),

  // items
  body('items').isArray({ min: 1 }).withMessage('Items array is required and must not be empty'),

  // ندعم product أو productId
  body('items.*.product').optional({ nullable: true }).isMongoId().withMessage('items.*.product must be a valid MongoDB ObjectId'),
  body('items.*.productId').optional({ nullable: true }).isMongoId().withMessage('items.*.productId must be a valid MongoDB ObjectId'),

  body('items.*.qty').isInt({ min: 1 }).withMessage('Each item qty must be at least 1'),

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

/* ==================== ضيوف: إنشاء أوردر ==================== */
// POST /api/orders  (ضيوف مسموح)
router.post('/', createOrderValidation, validate, createOrder);

/* ==================== أدمن: تصدير CSV ==================== */
// GET /api/orders/export.csv (Admin only)
// (حطه قبل "/:id" لتجنب أي التباس)
router.get('/export.csv', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { q, status } = req.query;
    const sort = buildSort(req.query);

    const filter = {};
    if (status) filter.status = status;
    if (q) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { 'customer.name': rx },
        { 'customer.email': rx },
        { 'customer.phone': rx },
      ];
    }

    const orders = await Order.find(filter).sort(sort).limit(5000);

    const rows = [['id','date','customer','email','phone','status','paymentMethod','totalKWD','itemsCount']];
    for (const o of orders) {
      const total = o.totalInFils != null ? (o.totalInFils / 1000).toFixed(3) : (o.total || 0);
      rows.push([
        String(o._id),
        o.createdAt ? new Date(o.createdAt).toISOString() : '',
        o.customer?.name || '',
        o.customer?.email || '',
        o.customer?.phone || '',
        o.status || '',
        o.paymentMethod || '',
        total,
        (o.items || []).reduce((a, b) => a + (b.qty || 0), 0),
      ]);
    }

    const csv = rows.map(r => r.map(v => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.send(csv);
  } catch (e) {
    console.error('orders.export error:', e);
    res.status(500).json({ message: 'Export failed' });
  }
});

/* ==================== أدمن: قائمة الطلبات ==================== */
// GET /api/orders  (Admin only) — مع فرز/بحث/تقسيم صفحات مرن
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { q, status } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const sort = buildSort(req.query);

    const filter = {};
    if (status) filter.status = status;
    if (q) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { 'customer.name': rx },
        { 'customer.email': rx },
        { 'customer.phone': rx },
      ];
    }

    const [items, total] = await Promise.all([
      Order.find(filter).sort(sort).skip(skip).limit(limit),
      Order.countDocuments(filter),
    ]);

    res.json({
      items,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (e) {
    console.error('orders.list error:', e);
    res.status(500).json({ message: 'Failed to list orders' });
  }
});

/* ==================== أدمن: تحديث حالة/دفعة الطلب ==================== */
// PUT /api/orders/:id  (Admin only)
router.put(
  '/:id',
  requireAuth,
  requireAdmin,
  [
    param('id').isMongoId().withMessage('Invalid order ID'),
    body('status').optional().isString().trim(),
    body('paymentStatus').optional().isString().trim(),
    body('paymentMethod').optional().isString().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const { status, paymentStatus, paymentMethod } = req.body || {};
      const patch = {};
      if (status) patch.status = status;
      if (paymentStatus) patch.paymentStatus = paymentStatus;
      if (paymentMethod) patch.paymentMethod = paymentMethod;

      const updated = await Order.findByIdAndUpdate(
        req.params.id,
        { $set: patch },
        { new: true }
      );

      if (!updated) return res.status(404).json({ message: 'Order not found' });
      res.json(updated);
    } catch (e) {
      console.error('orders.update error:', e);
      res.status(400).json({ message: 'Update failed' });
    }
  }
);

/* ==================== أدمن: PDF للفاتورة ==================== */
// GET /api/orders/:id/invoice.pdf (Admin only)
router.get(
  '/:id/invoice.pdf',
  requireAuth,
  requireAdmin,
  [param('id').isMongoId().withMessage('Invalid order ID')],
  validate,
  getInvoicePdf
);

/* ==================== محمي: عرض طلب واحد ==================== */
// GET /api/orders/:id (يتطلب تسجيل دخول؛ getOrder يتحقق من الملكية/الأدمن)
router.get(
  '/:id',
  requireAuth,
  [param('id').isMongoId().withMessage('Invalid order ID')],
  validate,
  getOrder
);

module.exports = router;
