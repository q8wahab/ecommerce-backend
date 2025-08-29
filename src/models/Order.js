// models/Order.js
const mongoose = require('mongoose');

const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

const OrderItemSchema = new Schema({
  // ندعم product أو productId (سنحوّل productId => product تلقائيًا)
  product:     { type: ObjectId, ref: 'Product' },
  productId:   { type: ObjectId, ref: 'Product' }, // (NEW) دعم رجعي للمدخلات

  title:       { type: String, required: true },
  priceInFils: { type: Number, required: true, min: 0 },
  currency:    { type: String, default: 'KWD' },
  qty:         { type: Number, required: true, min: 1 },
  image:       { type: String, default: null }
}, { _id: false });

// تأكيد وجود مرجع منتج: إن جا productId ننقله لـ product
OrderItemSchema.pre('validate', function (next) {
  if (!this.product && this.productId) this.product = this.productId;
  if (!this.product) {
    this.invalidate('product', 'Either product or productId is required');
  }
  next();
});

const OrderSchema = new Schema({
  invoiceNo: { type: String, required: true, unique: true, index: true },

  user: { type: ObjectId, ref: 'User' },

  customer: {
    name:  { type: String, required: true, trim: true },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{8}$/, 'Phone must be exactly 8 digits']
    },
    email: { type: String, trim: true, lowercase: true, default: '' }
  },

  shippingAddress: {
    area:    { type: String, required: true, trim: true },
    block:   { type: String, required: true, trim: true },
    street:  { type: String, required: true, trim: true },
    avenue:  { type: String, trim: true, default: '' },
    houseNo: { type: String, required: true, trim: true },
    notes:   { type: String, trim: true, default: '' }
  },

  items: [OrderItemSchema],

  subtotalInFils: { type: Number, required: true, min: 0 },
  shippingInFils: { type: Number, required: true, min: 0, default: 0 },
  totalInFils:    { type: Number, required: true, min: 0 },

  // (NEW) حالة الدفع وطريقة الدفع — مطلوبة لواجهة الأدمن/التصدير
  paymentMethod:  { type: String, default: '' },                // مثال: knet, cash, visa
  paymentStatus:  { type: String, default: 'pending' },         // مثال: pending, paid, failed, refunded

  // وسّعنا القيم لتتلاءم مع لوحة الأدمن + أبقينا قيمك السابقة
  status: {
    type: String,
    enum: [
      'pending', 'confirmed', 'processing', 'shipped',
      'completed', 'cancelled', 'fulfilled', 'paid'
    ],
    default: 'pending'
  }
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  }
});

OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ invoiceNo: 1 }, { unique: true });
// (اختياري) مفيد للاستعلام من لوحة الأدمن
OrderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Order', OrderSchema);
