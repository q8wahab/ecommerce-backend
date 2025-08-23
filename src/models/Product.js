// models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    index: 'text'
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  description: {
    type: String,
    trim: true
  },

  // السعر الحالي (إلزامي) — بالفلس
  priceInFils: {
    type: Number,
    required: true,
    min: 0
  },

  // السعر القديم (اختياري) — بالفلس
  // ✅ بدون validator يعتمد على this — المقارنة تتم في الكنترولر
  oldPriceInFils: {
    type: Number,
    min: 0,
    default: null
  },

  currency: {
    type: String,
    default: 'KWD'
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  rating: {
    rate: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  images: [{
    url: String,
    public_id: String,
    width: Number,
    height: Number,
    bytes: Number,
    format: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  status: {
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'active'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// نسبة الخصم (null إذا ما فيه oldPriceInFils أو غير أكبر)
productSchema.virtual('discountPercent').get(function () {
  if (this.oldPriceInFils == null || this.oldPriceInFils <= this.priceInFils) return null;
  return Math.round((1 - this.priceInFils / this.oldPriceInFils) * 100);
});

module.exports = mongoose.model('Product', productSchema);
