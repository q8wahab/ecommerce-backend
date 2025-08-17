const Product = require('../models/Product');
const Category = require('../models/Category');
const { parsePagination, createPaginationResponse } = require('../utils/pagination');

const getProducts = async (req, res) => {
  try {
    const { q, category, sort } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    
    // Build query
    let query = { status: 'active' };
    
    // Text search
    if (q) {
      query.$text = { $search: q };
    }
    
    // Category filter
    if (category) {
      const categoryDoc = await Category.findOne({ slug: category });
      if (categoryDoc) {
        query.category = categoryDoc._id;
      }
    }
    
    // Build sort
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
    
    // Execute query
    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name slug')
        .select('title slug priceInFils currency stock rating images status')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query)
    ]);
    
    // Format products for list view
    const formattedProducts = products.map(product => ({
      ...product,
      image: product.images?.find(img => img.isPrimary)?.url || product.images?.[0]?.url || null
    }));
    
    const response = createPaginationResponse(formattedProducts, page, limit, total);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProduct = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    
    // Try to find by ID first, then by slug
    let product;
    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      product = await Product.findById(idOrSlug).populate('category', 'name slug');
    } else {
      product = await Product.findOne({ slug: idOrSlug }).populate('category', 'name slug');
    }
    
    // if (!product || product.status !== 'active') {
      // return res.status(404).json({ error: 'Product not found' });
    // }
    
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
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
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
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
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
  updateProductImages
};

