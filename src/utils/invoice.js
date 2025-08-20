// utils/invoice.js
const crypto = require('crypto');

function dayOfYearUTC(d = new Date()) {
  const utcStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const utcNow = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diffDays = Math.floor((utcNow - utcStart) / 86400000) + 1; // 1..366
  return diffDays;
}

module.exports.genInvoiceNo = () => {
  const d = new Date();
  const y = d.getUTCFullYear(); // ثابت بالـ UTC
  const doy = dayOfYearUTC(d).toString().padStart(3, '0'); // 3 خانات
  const rand = crypto.randomInt(0, 1000).toString().padStart(3, '0'); // 3 خانات
  // مثال: INV-2025-123456  => 123 (اليوم) + 456 (عشوائي)
  return `INV-${y}-${doy}${rand}`;
};
