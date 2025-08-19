// controllers/product.controller.js
const Product = require('../models/Product');
const Category = require('../models/Category');
const { parsePagination, createPaginationResponse } = require('../utils/pagination');

const isObjectId = (val = '') => /^[0-9a-fA-F]{24}$/.test(val);
const escapeRegex = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * GET /api/products
 * Query:
 *  - q: search term (Regex, case-insensitive, لأي طول)
 *  - category: ObjectId أو slug (بدون حساسية أحرف)
 *  - sort: priceAsc|priceDesc|ratingDesc|titleAsc
 *  - page, limit
 */
const getProducts = async (req, res) => {
  try {
    const { q, category, sort } = req.query;
    const { page, limit, skip } = parsePagination(req.query);

    // Base filter
    const query = { status: 'active' };

    // -------- Search (Regex لأي طول) --------
    const term = (q || '').trim();
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i'); // contains, case-insensitive
      query.$or = [{ title: rx }, { description: rx }];
    }

    // -------- Category filter (_id أو slug بدون حساسية أحرف) --------
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
        // slug غير موجود → نتيجة فارغة واضحة
        const empty = createPaginationResponse([], page, limit, 0);
        return res.json(empty);
      }
    }

    // -------- Sort --------
    let sortOptions = {};
    switch (sort) {
      case 'priceAsc':
        sortOptions = { priceInFils: 1 };
        break;
      case 'priceDesc':
        sortOptions = { priceInFils: -1 };
        break;
      case 'ratingDesc':
        sortOptions = { 'rating.rate': -1 };
        break;
      case 'titleAsc':
        sortOptions = { title: 1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    // -------- Projection --------
    const projection = {
      title: 1,
      slug: 1,
      priceInFils: 1,
      currency: 1,
      stock: 1,
      rating: 1,
      images: 1,
      status: 1,
      category: 1,
    };

    // -------- Execute --------
    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name slug')
        .select(projection)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
    ]);

    // -------- Format list view --------
    const formatted = products.map((p) => ({
      ...p,
      image:
        p.images?.find((img) => img.isPrimary)?.url ||
        p.images?.[0]?.url ||
        null,
    }));

    const response = createPaginationResponse(formatted, page, limit, total);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/products/:idOrSlug
 * يقبل ObjectId أو slug بدون حساسية أحرف
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

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    await product.populate('category', 'name slug');
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('category', 'name slug');

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
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
