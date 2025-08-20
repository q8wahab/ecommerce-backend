// utils/invoice.js
module.exports.genInvoiceNo = () => {
  const y = new Date().getFullYear();
  const suffix = (Date.now() % 1e6).toString().padStart(6, '0');
  return `INV-${y}-${suffix}`;
};
