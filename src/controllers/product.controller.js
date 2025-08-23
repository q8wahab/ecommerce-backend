// controllers/product.controller.js
const Product = require('../models/Product');
const Category = require('../models/Category');
const { parsePagination, createPaginationResponse } = require('../utils/pagination');

const isObjectId = (val = '') => /^[0-9a-fA-F]{24}$/.test(val);
const escapeRegex = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const numOrNull = (v) => {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ===== CSV helpers =====
const csvEscape = (v) => {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};
const toCSV = (rows) => rows.map(r => r.map(csvEscape).join(',')).join('\n');

// very small CSV parser (handles quotes and escaped quotes)
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i += 2; continue; } // escaped quote
        inQuotes = false; i++; continue;
      }
      cur += ch; i++; continue;
    }

    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(cur); cur = ''; i++; continue; }
    if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    cur += ch; i++;
  }
  row.push(cur);
  rows.push(row);
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(h => String(h || '').trim());
  return rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, idx) => { o[h] = r[idx] ?? ''; });
    return o;
  });
}

// ====== LIST ======
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
        .lean(),
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

// ====== GET ONE ======
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

    return res.json(product);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ====== CREATE ======
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
      oldPriceInFils,
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

// ====== UPDATE ======
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

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

    if (hasOld && update.oldPriceInFils == null) {
      update.oldPriceInFils = null;
    }

    if (hasPrice && hasOld && update.oldPriceInFils != null && update.priceInFils != null) {
      if (Number(update.oldPriceInFils) <= Number(update.priceInFils)) {
        return res.status(400).json({ error: 'oldPriceInFils must be greater than priceInFils' });
      }
    }

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

// ====== DELETE ======
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ====== UPDATE IMAGES ======
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

// ====== CSV EXPORT ======
const exportProductsCSV = async (req, res) => {
  try {
    // نفس فلاتر getProducts مبسّطة (اختياري)
    const { q, category } = req.query;
    const query = {};
    const term = (q || '').trim();
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      query.$or = [{ title: rx }, { description: rx }];
    }
    if (category) {
      if (isObjectId(category)) {
        query.category = category;
      } else {
        const cat = await Category.findOne({ slug: new RegExp(`^${escapeRegex(category)}$`, 'i') }).select('_id');
        if (cat) query.category = cat._id;
      }
    }

    const products = await Product.find(query)
      .populate('category', 'name slug')
      .lean();

    const header = [
      'title',
      'slug',
      'description',
      'priceInFils',
      'oldPriceInFils',
      'currency',
      'stock',
      'categorySlug',
      'status',
      'imagePrimaryUrl',
      'ratingRate',
      'ratingCount',
      'createdAt',
      'updatedAt',
    ];

    const rows = [header];
    for (const p of products) {
      const img = (p.images || []).find(i => i.isPrimary) || (p.images || [])[0] || {};
      rows.push([
        p.title ?? '',
        p.slug ?? '',
        p.description ?? '',
        p.priceInFils ?? '',
        p.oldPriceInFils ?? '',
        p.currency ?? 'KWD',
        p.stock ?? 0,
        p.category?.slug ?? '',
        p.status ?? 'active',
        img?.url ?? '',
        p.rating?.rate ?? 0,
        p.rating?.count ?? 0,
        p.createdAt ? new Date(p.createdAt).toISOString() : '',
        p.updatedAt ? new Date(p.updatedAt).toISOString() : '',
      ]);
    }

    const csv = toCSV(rows);
    const filename = `products-${new Date().toISOString().slice(0,10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ====== CSV IMPORT ======
const importProductsCSV = async (req, res) => {
  try {
    // الخيارات: upsertBy=slug | none ، dryRun=true/false
    const upsertBy = (req.body.upsertBy || 'slug').toLowerCase(); // 'slug' | 'none'
    const dryRun = String(req.body.dryRun || 'false').toLowerCase() === 'true';

    // الملف
    let csvText = '';
    if (req.file?.buffer) {
      csvText = req.file.buffer.toString('utf8');
    } else if (req.body.csvText) {
      csvText = String(req.body.csvText);
    } else {
      return res.status(400).json({ error: 'CSV file is required (field name: file)' });
    }

    const rows = parseCSV(csvText);
    const objs = rowsToObjects(rows);

    const allowedStatus = new Set(['draft', 'active', 'archived']);
    const result = {
      total: objs.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [], // {row, slug, error}
    };

    for (let idx = 0; idx < objs.length; idx++) {
      const row = objs[idx];
      const rowNum = idx + 2; // header = row 1

      // قراءة الأعمدة (بأسماء الهيدر)
      const title = (row.title || '').trim();
      const slug = (row.slug || '').trim();
      const description = row.description || '';
      const priceInFils = numOrNull(row.priceInFils);
      const oldPriceInFils = numOrNull(row.oldPriceInFils);
      const currency = (row.currency || 'KWD').trim();
      const stock = numOrNull(row.stock) ?? 0;
      const status = allowedStatus.has((row.status || 'active')) ? row.status : 'active';
      const categorySlug = (row.categorySlug || '').trim().toLowerCase();
      const imagePrimaryUrl = (row.imagePrimaryUrl || '').trim();

      // فحوصات أساسية
      if (!title) { result.errors.push({ row: rowNum, slug, error: 'Missing title' }); result.skipped++; continue; }
      if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
        result.errors.push({ row: rowNum, slug, error: 'Invalid slug' }); result.skipped++; continue;
      }
      if (priceInFils == null || priceInFils < 0) {
        result.errors.push({ row: rowNum, slug, error: 'Invalid priceInFils' }); result.skipped++; continue;
      }
      if (oldPriceInFils != null && oldPriceInFils <= priceInFils) {
        result.errors.push({ row: rowNum, slug, error: 'oldPriceInFils must be > priceInFils' }); result.skipped++; continue;
      }

      // category (بالـ slug اختيارياً)
      let categoryId = undefined;
      if (categorySlug) {
        const cat = await Category.findOne({ slug: new RegExp(`^${escapeRegex(categorySlug)}$`, 'i') }).select('_id');
        if (!cat) {
          result.errors.push({ row: rowNum, slug, error: `Category slug not found: ${categorySlug}` });
          result.skipped++;
          continue;
        }
        categoryId = cat._id;
      }

      // جاهز للبناء
      const doc = {
        title, slug, description,
        priceInFils,
        oldPriceInFils: oldPriceInFils ?? null,
        currency,
        stock,
        status,
        images: imagePrimaryUrl ? [{ url: imagePrimaryUrl, isPrimary: true }] : [],
      };
      if (categoryId) doc.category = categoryId;

      if (dryRun) {
        // لا حفظ — فقط إحصائيات تقديرية (نعتبره upsert حسب الخيار)
        if (upsertBy === 'slug') {
          const exists = await Product.exists({ slug });
          if (exists) result.updated++; else result.inserted++;
        } else {
          result.inserted++;
        }
        continue;
      }

      // حفظ فعلي
      if (upsertBy === 'slug') {
        const existing = await Product.findOne({ slug }).select('_id');
        if (existing) {
          await Product.findByIdAndUpdate(existing._id, doc, { runValidators: true });
          result.updated++;
        } else {
          await Product.create(doc);
          result.inserted++;
        }
      } else {
        await Product.create(doc);
        result.inserted++;
      }
    }

    return res.json(result);
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
  // 👇 جديد
  exportProductsCSV,
  importProductsCSV,
};
