// src/controllers/order.controller.js
const Order = require('../models/Order');
const Product = require('../models/Product');
const { genInvoiceNo } = require('../utils/invoice');
const { sendOrderInvoiceEmail } = require('../services/invoice-mailer');

// ✅ خدمة واتساب بالقالب
const { sendOrderWhatsApp, toWhatsAppE164 } = require('../services/whatsapp');

const toInt = (x, def = 0) => {
  const n = parseInt(x, 10);
  return Number.isFinite(n) ? n : def;
};

exports.createOrder = async (req, res) => {
  try {
    const { customer = {}, shippingAddress = {}, items = [], paymentMethod } = req.body || {};

    // الحقول المطلوبة
    if (
      !customer?.name ||
      !customer?.phone ||
      !shippingAddress?.area ||
      !shippingAddress?.block ||
      !shippingAddress?.street ||
      !shippingAddress?.houseNo
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // رقم الهاتف 8 أرقام
    const phoneDigits = String(customer.phone).replace(/\D/g, '');
    if (!/^\d{8}$/.test(phoneDigits)) {
      return res.status(400).json({ error: 'Phone must be exactly 8 digits' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order items are required' });
    }

    const productIds = [
      ...new Set(
        items
          .map((i) => i.product || i.productId)
          .filter(Boolean)
          .map(String)
      ),
    ];
    if (productIds.length === 0) {
      return res.status(400).json({ error: 'No valid product IDs' });
    }

    const dbProducts = await Product.find({
      _id: { $in: productIds },
      status: 'active',
    }).select('title priceInFils images stock currency');

    const byId = new Map(dbProducts.map((p) => [String(p._id), p]));

    const orderItems = [];
    let subtotal = 0;

    for (const line of items) {
      const pid = String(line.product || line.productId || '');
      const qty = Math.max(1, toInt(line.qty, 1));
      const p = byId.get(pid);

      if (!p) {
        return res.status(400).json({ error: `Product not found or inactive: ${pid}` });
      }
      if (Number.isFinite(p.stock) && p.stock < qty) {
        return res.status(400).json({ error: `Insufficient stock for product: ${p.title}` });
      }

      const price = toInt(p.priceInFils, 0);
      const image =
        p.images?.find((i) => i.isPrimary)?.url ||
        p.images?.[0]?.url ||
        null;

      orderItems.push({
        product: p._id,
        title: p.title,
        priceInFils: price,
        currency: p.currency || 'KWD',
        qty,
        image,
      });

      subtotal += price * qty;
    }

    if (orderItems.length === 0) {
      return res.status(400).json({ error: 'No valid items to order' });
    }

    // سياسة الشحن
    const THRESHOLD = toInt(process.env.FREE_SHIP_THRESHOLD_IN_FILS, 15000);
    const BASE_SHIP = toInt(process.env.BASE_SHIPPING_IN_FILS, 2000);
    const shipping = subtotal >= THRESHOLD ? 0 : BASE_SHIP;
    const total = subtotal + shipping;

    const order = await Order.create({
      invoiceNo: genInvoiceNo(),
      user: req.user?._id || null,
      customer: {
        name: customer.name.trim(),
        phone: phoneDigits,
        email: (customer.email || '').trim(),
      },
      shippingAddress: {
        area: shippingAddress.area.trim(),
        block: shippingAddress.block.trim(),
        street: shippingAddress.street.trim(),
        avenue: (shippingAddress.avenue || '').trim(),
        houseNo: shippingAddress.houseNo.trim(),
        notes: (shippingAddress.notes || '').trim(),
      },
      items: orderItems,
      subtotalInFils: subtotal,
      shippingInFils: shipping,
      totalInFils: total,
      status: 'pending',
    });

    // نقص المخزون (best-effort)
    Promise.all(
      orderItems.map((it) =>
        Product.updateOne({ _id: it.product }, { $inc: { stock: -it.qty } })
      )
    ).catch((e) => console.error('Stock decrement error:', e.message));

    // إيميل (غير مُعطِّل لسير الطلب)
    sendOrderInvoiceEmail(order).catch((e) => {
      console.error('Email send error:', e.message);
    });

    // واتساب بالقالب المعتمد (Fire-and-forget)
    (async () => {
      try {
        const totalKwd = (order.totalInFils / 1000).toFixed(3);
        const currency = order.items?.[0]?.currency || 'KWD';
        const payMethod = ' سيتم إرسال رابط الدفع لكم لتأكيد الطلب';
        const address = `${order.shippingAddress.area}, Block ${order.shippingAddress.block}, Street ${order.shippingAddress.street}, House ${order.shippingAddress.houseNo}`;
        const eta = 'Within 24 hours';

        // القالب الإنجليزي اللي عطيتني:
        // Hi {{1}} 👋
        // We’ve received your order {{2}} successfully.
        // Total: {{3}} {{4}}
        // Payment method: {{5}}
        // Shipping address: {{6}}
        // Estimated delivery: {{7}}
        const vars = {
          "1": order.customer.name,
          "2": order.invoiceNo,
          "3": totalKwd,
          "4": currency,
          "5": payMethod,
          "6": address,
          "7": eta
        };

        await sendOrderWhatsApp({
          toE164: toWhatsAppE164(order.customer.phone), // يقبل 8 أرقام محلية
          vars
        });
      } catch (e) {
        console.error('[whatsapp after order]', e.message);
      }
    })();

    return res.status(201).json({
      id: order._id,
      invoiceNo: order.invoiceNo,
      subtotalInFils: order.subtotalInFils,
      shippingInFils: order.shippingInFils,
      totalInFils: order.totalInFils,
      status: order.status,
      createdAt: order.createdAt,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate('items.product', 'title slug images')
      .populate('user', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (req.user && req.user.role !== 'admin') {
      if (!order.user || String(order.user._id) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    return res.json(order);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
