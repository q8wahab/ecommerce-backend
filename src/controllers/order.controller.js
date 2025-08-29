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

const DEFAULT_PAYMENT_STATUS = 'pending';

async function createOrderDocument(payload, tryOnceIfDuplicate = true) {
  try {
    return await Order.create(payload);
  } catch (err) {
    // لو صار تعارض بالمفتاح الفريد لرقم الفاتورة، جرّب مرة ثانية فقط
    if (tryOnceIfDuplicate && err && err.code === 11000 && /invoiceNo/i.test(String(err.message))) {
      payload.invoiceNo = genInvoiceNo();
      return createOrderDocument(payload, false);
    }
    throw err;
  }
}

exports.createOrder = async (req, res) => {
  try {
    const {
      customer = {},
      shippingAddress = {},
      items = [],
      paymentMethod,      // 👈 ناخذها من الـbody لو موجودة
      paymentStatus,      // 👈 لو بعتها (نادرًا)، وإلا نخليها pending
    } = req.body || {};

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

    const orderPayload = {
      invoiceNo: genInvoiceNo(),
      user: req.user?._id || null,
      customer: {
        name: customer.name.trim(),
        phone: phoneDigits,
        email: (customer.email || '').trim().toLowerCase(),
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
      paymentMethod: (paymentMethod || '').trim(),                    // 👈 يُحفظ لو مرسَل
      paymentStatus: (paymentStatus || DEFAULT_PAYMENT_STATUS).trim() // 👈 pending افتراضيًا
    };

    const order = await createOrderDocument(orderPayload);

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
        const payMethodText = order.paymentMethod
          ? order.paymentMethod
          : 'سيتم إرسال رابط الدفع لكم لتأكيد الطلب';
        const address = `${order.shippingAddress.area}, Block ${order.shippingAddress.block}, Street ${order.shippingAddress.street}, House ${order.shippingAddress.houseNo}`;
        const eta = 'Within 24 hours';

        // القالب الإنجليزي:
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
          "5": payMethodText,
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
      paymentMethod: order.paymentMethod || '',
      paymentStatus: order.paymentStatus || DEFAULT_PAYMENT_STATUS,
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


// === PDF Invoice (HTML renderer + puppeteer) ===
const puppeteer = require('puppeteer');

function renderInvoiceHtml(order) {
  const items = order.items || [];
  const toKwd = (fils) => (typeof fils === 'number' ? (fils / 1000).toFixed(3) : (order.total || 0));
  const totalKwd = toKwd(order.totalInFils);
  const subKwd = toKwd(order.subtotalInFils);
  const shipKwd = toKwd(order.shippingInFils);
  const addr = order.shippingAddress || {};
  const cust = order.customer || {};

  const fmt = (v) => (v == null || v === '' ? '-' : String(v));

  const addressLines = [
    addr.area ? `Area: ${addr.area}` : null,
    addr.block ? `Block: ${addr.block}` : null,
    addr.street ? `Street: ${addr.street}` : null,
    addr.avenue ? `Avenue: ${addr.avenue}` : null,
    addr.houseNo ? `House: ${addr.houseNo}` : null,
    addr.notes ? `Notes: ${addr.notes}` : null,
  ].filter(Boolean);

  const rows = items.map((it, i) => {
    const lineTotal = (it.priceInFils || 0) * (it.qty || 1);
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${fmt(it.title || it.product?.title)}</td>
        <td>${fmt(it.qty)}</td>
        <td>${toKwd(it.priceInFils)}</td>
        <td>${toKwd(lineTotal)}</td>
      </tr>`;
  }).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${order.invoiceNo}</title>
  <style>
    body{font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif; color:#222; margin:24px;}
    .header{display:flex; justify-content:space-between; align-items:flex-start; gap:16px;}
    h1{margin:0 0 4px;}
    small{color:#666}
    .box{border:1px solid #ddd; border-radius:8px; padding:12px; margin:12px 0;}
    table{width:100%; border-collapse:collapse; margin-top:6px;}
    th,td{border:1px solid #eee; padding:8px; text-align:left;}
    th{background:#fafafa}
    .totals{margin-top:8px; width:280px; margin-left:auto;}
    .totals td{border:none; padding:4px 0;}
    .badges{display:flex; gap:8px; align-items:center}
    .badge{border:1px solid #ccc; border-radius:20px; padding:2px 10px; font-size:12px;}
    .right{text-align:right}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Invoice</h1>
      <div><small>#${order.invoiceNo}</small></div>
      <div><small>${order.createdAt ? new Date(order.createdAt).toLocaleString() : ''}</small></div>
      <div class="badges" style="margin-top:6px">
        <span class="badge">Status: ${fmt(order.status)}</span>
        <span class="badge">Payment: ${fmt(order.paymentMethod)}</span>
        <span class="badge">Pay Status: ${fmt(order.paymentStatus)}</span>
      </div>
    </div>
    <div>
      <strong>24ozkw</strong><br/>
      <small>support@24ozkw.com</small>
    </div>
  </div>

  <div class="box">
    <strong>Customer</strong><br/>
    ${fmt(cust.name)}<br/>
    <small>${fmt(cust.email)}</small><br/>
    <small>${fmt(cust.phone)}</small>
  </div>

  <div class="box">
    <strong>Shipping Address</strong>
    <div style="margin-top:6px">
      ${addressLines.length ? addressLines.map(l => `<div>${l}</div>`).join('') : '-'}
    </div>
  </div>

  <div class="box">
    <strong>Items</strong>
    <table>
      <thead>
        <tr><th>#</th><th>Product</th><th>Qty</th><th>Price (KWD)</th><th>Total (KWD)</th></tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="5">No items</td></tr>`}</tbody>
    </table>

    <table class="totals">
      <tbody>
        <tr><td>Subtotal:</td><td class="right">${subKwd} KWD</td></tr>
        <tr><td>Shipping:</td><td class="right">${shipKwd} KWD</td></tr>
        <tr><td><strong>Grand Total:</strong></td><td class="right"><strong>${totalKwd} KWD</strong></td></tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

exports.getInvoicePdf = async (req, res) => {
  try {
    const { id } = req.params;
    // إدمن فقط (التحقق يتم في الراوتر)
    const order = await Order.findById(id)
      .populate('items.product', 'title')
      .populate('user', 'name email');

    if (!order) return res.status(404).json({ message: 'Order not found' });

    const html = renderInvoiceHtml(order);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' }
    });

    await browser.close();

    const filename = `invoice_${order.invoiceNo || String(order._id).slice(-6)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.end(pdf);
  } catch (e) {
    console.error('invoice.pdf error:', e);
    res.status(500).json({ message: 'Failed to render invoice PDF' });
  }
};
