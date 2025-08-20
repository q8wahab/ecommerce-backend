// config/mail.js
module.exports = {
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false') === 'true',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.MAIL_FROM || 'Store <no-reply@localhost>',
  bcc: process.env.MAIL_BCC || '', // توصلك نسخة لكل فاتورة
};
