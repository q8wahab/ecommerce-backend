// controllers/product.controller.js
const Product = require('../models/Product');
const Category = require('../models/Category');
const { parsePagination, createPaginationResponse } = require('../utils/pagination');

const isObjectId = (val = '') => /^[0-9a-fA-F]{24}$/.test(val);
const escapeRegex = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// helper: '' | undefined | null -> null, otherwise Number(...)
const numOrNull = (v) => {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * GET /api/products
 * Query:
 *  - q: search term
 *  - category: ObjectId or slug (case-insensitive)
 *  - sort: priceAsc|priceDesc|ratingDesc|titleAsc
 *  - page, limit
 */
const getProducts = async (req, res) => {
  try {
    const { q, category, sort } = req.query;
    const { page, limit, skip } = parsePagination(req.query);

    const query = { status: 'active' };

    // search
    const term = (q || '').trim();
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      query.$or = [{ title: rx }, { description: rx }];
    }

    // category (_id or slug)
    if (category) {
      let categoryId = null;
      if (isObjectId(category)) {
        categoryId = category;
      } else {
        const catDoc = await Category.findOne({
          slug: new RegExp(`^${escapeRegex(category)}$`, 'i'),
        }).select('_id');
        categoryId = catDoc?._id || null;
      }
      if (categoryId) {
        query.category = categoryId;
      } else {
        return res.json(createPaginationResponse([], page, limit, 0));
      }
    }

    // sort
    let sortOptions = {};
    switch (sort) {
      case 'priceAsc': sortOptions = { priceInFils: 1 }; break;
      case 'priceDesc': sortOptions = { priceInFils: -1 }; break;
      case 'ratingDesc': sortOptions = { 'rating.rate': -1 }; break;
      case 'titleAsc': sortOptions = { title: 1 }; break;
      default: sortOptions = { createdAt: -1 };
    }

    // projection (include oldPriceInFils)
    const projection = {
      title: 1,
      slug: 1,
      priceInFils: 1,
      oldPriceInFils: 1,
      currency: 1,
      stock: 1,
      rating: 1,
      images: 1,
      status: 1,
      category: 1,
      createdAt: 1,
    };

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name slug')
        .select(projection)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }), // نفعّل virtuals مثل discountPercent لو احتجتها بالواجهة
      Product.countDocuments(query),
    ]);

    const formatted = products.map((p) => ({
      ...p,
      image:
        p.images?.find((img) => img.isPrimary)?.url ||
        p.images?.[0]?.url ||
        null,
    }));

    return res.json(createPaginationResponse(formatted, page, limit, total));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/products/:idOrSlug
 */
const getProduct = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let product;

    if (isObjectId(idOrSlug)) {
      product = await Product.findById(idOrSlug).populate('category', 'name slug');
    } else {
      product = await Product.findOne({
        slug: new RegExp(`^${escapeRegex(idOrSlug)}$`, 'i'),
      }).populate('category', 'name slug');
    }

    if (!product || product.status !== 'active') {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.json(product); // toJSON في الموديل مفعّل لإرجاع virtuals
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    let {
      title,
      slug,
      description,
      priceInFils,
      oldPriceInFils, // optional
      currency,
      stock,
      category,
      images,
      status,
    } = req.body;

    // coerce numbers
    priceInFils = numOrNull(priceInFils);
    oldPriceInFils = numOrNull(oldPriceInFils);
    stock = numOrNull(stock);
    if (stock === null) stock = 0;

    if (oldPriceInFils != null && priceInFils != null && oldPriceInFils <= priceInFils) {
      return res.status(400).json({ error: 'oldPriceInFils must be greater than priceInFils' });
    }

    const product = new Product({
      title,
      slug,
      description,
      priceInFils,
      oldPriceInFils, // null ok
      currency,
      stock,
      category,
      images,
      status,
    });

    await product.save();
    await product.populate('category', 'name slug');
    return res.status(201).json(product);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // اجمع فقط الحقول المُرسلة
    const fields = [
      'title', 'slug', 'description',
      'priceInFils', 'oldPriceInFils',
      'currency', 'stock', 'category',
      'images', 'status'
    ];
    const update = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) update[f] = req.body[f];
    }

    // تهيئة رقمية
    const toNumOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
    if (Object.prototype.hasOwnProperty.call(update, 'priceInFils')) {
      update.priceInFils = toNumOrNull(update.priceInFils);
    }
    if (Object.prototype.hasOwnProperty.call(update, 'oldPriceInFils')) {
      update.oldPriceInFils = toNumOrNull(update.oldPriceInFils);
    }
    if (Object.prototype.hasOwnProperty.call(update, 'stock')) {
      const s = toNumOrNull(update.stock);
      update.stock = s == null ? 0 : s;
    }

    const hasPrice = Object.prototype.hasOwnProperty.call(update, 'priceInFils');
    const hasOld   = Object.prototype.hasOwnProperty.call(update, 'oldPriceInFils');

    // لو أرسل oldPriceInFils = null → إلغاء الخصم صراحةً
    if (hasOld && update.oldPriceInFils == null) {
      update.oldPriceInFils = null;
    }

    // تحقق العلاقة:
    // 1) لو أُرسل الاثنان في نفس الطلب وقيمتهما غير null
    if (hasPrice && hasOld && update.oldPriceInFils != null && update.priceInFils != null) {
      if (Number(update.oldPriceInFils) <= Number(update.priceInFils)) {
        return res.status(400).json({ error: 'oldPriceInFils must be greater than priceInFils' });
      }
    }

    // 2) لو أُرسل oldPriceInFils فقط (بدون priceInFils) → قارن بسعر الداتابيس الحالي
    if (hasOld && !hasPrice && update.oldPriceInFils != null) {
      const current = await Product.findById(id).select('priceInFils');
      if (!current) return res.status(404).json({ error: 'Product not found' });
      if (Number(update.oldPriceInFils) <= Number(current.priceInFils)) {
        return res.status(400).json({ error: 'oldPriceInFils must be greater than priceInFils' });
      }
    }

    const product = await Product.findByIdAndUpdate(
      id,
      update,
      { new: true, runValidators: true }
    ).populate('category', 'name slug');

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.json(product);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const updateProductImages = async (req, res) => {
  try {
    const { id } = req.params;
    const { images } = req.body;

    const product = await Product.findByIdAndUpdate(
      id,
      { $push: { images: { $each: images } } },
      { new: true }
    );

    if (!product) return res.status(404).json({ error: 'Product not found' });

    return res.json(product);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductImages,
};
