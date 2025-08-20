// models/Order.js
const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  title:       { type: String, required: true },
  priceInFils: { type: Number, required: true, min: 0 },
  currency:    { type: String, default: 'KWD' },
  qty:         { type: Number, required: true, min: 1 },
  image:       { type: String, default: null }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  invoiceNo: { type: String, required: true, unique: true, index: true },

  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  customer: {
    name:  { type: String, required: true, trim: true },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{8}$/, 'Phone must be exactly 8 digits']
    },
    email: { type: String, trim: true, lowercase: true, default: '' } // 👈 lowercase
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

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'fulfilled'], // 👈 لا تستخدم 'paid' الآن
    default: 'pending'
  }
}, {
  timestamps: true,
  versionKey: false, // 👈 اختياري: يخفي __v
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

module.exports = mongoose.model('Order', OrderSchema);
