// models/Order.js
const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  title:       { type: String, required: true },
  priceInFils: { type: Number, required: true, min: 0 },
  currency:    { type: String, default: 'KWD' },
  qty:         { type: Number, required: true, min: 1 },
  image:       { type: String, default: null } // اختياري للعرض في الإيميل/لوحة التحكم
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  // رقم فاتورة شكلي وفريد — نولّده عند الإنشاء
  invoiceNo: { type: String, required: true, unique: true },

  // لو عندك مستخدم مسجّل — اختياري الآن
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // بيانات العميل
  customer: {
    name:  { type: String, required: true, trim: true }, // الاسم
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{8}$/, 'Phone must be exactly 8 digits'] // 8 أرقام بالضبط
    },
    email: { type: String, trim: true, default: '' }      // اختياري
  },

  // العنوان (الكويت)
  shippingAddress: {
    area:    { type: String, required: true, trim: true }, // المنطقه
    block:   { type: String, required: true, trim: true }, // القطعه
    street:  { type: String, required: true, trim: true }, // الشارع
    avenue:  { type: String, trim: true, default: '' },    // جاده (اختياري)
    houseNo: { type: String, required: true, trim: true }, // رقم المنزل
    notes:   { type: String, trim: true, default: '' }     // تعليمات التوصيل (اختياري)
  },

  // عناصر الطلب
  items: [OrderItemSchema],

  // المجموعات بالـ fils
  subtotalInFils: { type: Number, required: true, min: 0 },
  shippingInFils: { type: Number, required: true, min: 0, default: 0 },
  totalInFils:    { type: Number, required: true, min: 0 },

  // حالة الطلب (بدون دفع الآن)
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'fulfilled'], default: 'pending' }
}, {
  timestamps: true
});

// فهارس مفيدة
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ invoiceNo: 1 }, { unique: true });

module.exports = mongoose.model('Order', OrderSchema);
