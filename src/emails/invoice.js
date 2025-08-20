// emails/invoice.js
function kwd(fils) {
  const v = Number(fils || 0) / 1000;
  return `KWD ${v.toFixed(3)}`;
}

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderItemsRows(order) {
  return (order.items || [])
    .map(
      (it) => `
        <tr>
          <td style="padding:8px;border:1px solid #eee">${esc(it.title)}</td>
          <td style="padding:8px;border:1px solid #eee">${it.qty}</td>
          <td style="padding:8px;border:1px solid #eee">${kwd(it.priceInFils)}</td>
          <td style="padding:8px;border:1px solid #eee">${kwd(it.priceInFils * it.qty)}</td>
        </tr>`
    )
    .join('');
}

function renderAddress(order) {
  const a = order.shippingAddress || {};
  const c = order.customer || {};
  return `
    <p style="margin:0 0 6px 0"><strong>${esc(c.name || '')}</strong> — ${esc(c.phone || '')}</p>
    <p style="margin:0 0 6px 0">
      ${esc(a.area || '')}, Block ${esc(a.block || '')}, Street ${esc(a.street || '')}
      ${a.avenue ? `, Ave ${esc(a.avenue)}` : ''}, House ${esc(a.houseNo || '')}
    </p>
    ${a.notes ? `<p style="margin:0;color:#666">Notes: ${esc(a.notes)}</p>` : ''}
  `;
}

function renderInvoiceHtml(order = {}) {
  const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();

  return `
  <div style="font-family:Arial,sans-serif;max-width:720px;margin:auto">
    <h2 style="margin-bottom:4px">24ozKw – Invoice ${esc(order.invoiceNo || String(order._id || ''))}</h2>
    <div style="color:#666;margin-bottom:16px">
      <span>${createdAt.toLocaleString()}</span> • <span>Status: ${esc(order.status || 'pending')}</span>
    </div>

    <h3 style="margin:12px 0">Order Items</h3>
    <table style="border-collapse:collapse;width:100%;border:1px solid #eee">
      <thead>
        <tr style="background:#fafafa">
          <th style="text-align:left;padding:8px;border:1px solid #eee">Item</th>
          <th style="text-align:left;padding:8px;border:1px solid #eee">Qty</th>
          <th style="text-align:left;padding:8px;border:1px solid #eee">Unit</th>
          <th style="text-align:left;padding:8px;border:1px solid #eee">Total</th>
        </tr>
      </thead>
      <tbody>${renderItemsRows(order)}</tbody>
    </table>

    <div style="margin-top:12px">
      <p style="margin:4px 0"><strong>Subtotal:</strong> ${kwd(order.subtotalInFils)}</p>
      <p style="margin:4px 0"><strong>Shipping:</strong> ${kwd(order.shippingInFils)}</p>
      <p style="margin:4px 0;font-size:1.1em"><strong>Total:</strong> ${kwd(order.totalInFils)}</p>
    </div>

    <h3 style="margin:16px 0 8px">Shipping Address</h3>
    ${renderAddress(order)}
  </div>
  `;
}

module.exports = { renderInvoiceHtml };
