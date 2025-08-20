// services/invoice-mailer.js
const { sendMail } = require('./mailer');
const { renderInvoiceHtml } = require('../emails/invoice');

function renderInvoiceText(order) {
  const lines = [];
  lines.push(`Invoice ${order.invoiceNo || order._id} – 24ozKw`);
  lines.push(`Status: ${order.status}`);
  lines.push('');
  lines.push('Items:');
  for (const it of order.items || []) {
    const unit = (it.priceInFils / 1000).toFixed(3);
    const total = ((it.priceInFils * it.qty) / 1000).toFixed(3);
    lines.push(`- ${it.title} x${it.qty} — KWD ${unit} (total KWD ${total})`);
  }
  lines.push('');
  lines.push(`Subtotal: KWD ${(order.subtotalInFils / 1000).toFixed(3)}`);
  lines.push(`Shipping: KWD ${(order.shippingInFils / 1000).toFixed(3)}`);
  lines.push(`Total:    KWD ${(order.totalInFils / 1000).toFixed(3)}`);
  return lines.join('\n');
}

async function sendOrderInvoiceEmail(order) {
  const to = order.customer?.email && order.customer.email.trim()
    ? order.customer.email.trim()
    : undefined; // لو undefined سيتم الإرسال فقط لـ BCC (متجرك)
  const subject = `Invoice ${order.invoiceNo || order._id} – 24ozKw`;
  const html = renderInvoiceHtml(order);
  const text = renderInvoiceText(order);

  try {
    await sendMail({
      to,           // عميلك إن وُجد
      subject,
      html,
      text,
      replyTo: to,  // خليه يرد على العميل
    });
  } catch (err) {
    console.error('Failed to send invoice email:', err.message);
  }
}

module.exports = { sendOrderInvoiceEmail };
