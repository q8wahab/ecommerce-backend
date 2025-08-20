// services/mailer.js
const nodemailer = require('nodemailer');

const {
  SMTP_HOST = 'smtp.ethereal.email',
  SMTP_PORT = '587',
  SMTP_SECURE = 'false',
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM = '24ozKw Store <noreply@24ozkw.com>',
  ORDER_RECEIVER_EMAIL,
  // 👇 جديدة من .env
  SMTP_LOG = 'false',
  SMTP_DEBUG = 'false',
  SMTP_QUIET = 'false',
} = process.env;

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const enableLogger = String(SMTP_LOG).toLowerCase() === 'true';
  const enableDebug  = String(SMTP_DEBUG).toLowerCase() === 'true';

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: String(SMTP_SECURE).toLowerCase() === 'true' || Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    logger: enableLogger,
    debug: enableDebug,
    // tls: { ciphers: 'TLSv1.2' }, // اختياري، عادةً غير مطلوب
  });

  return transporter;
}

async function sendMail({ to, subject, html, text, attachments } = {}) {
  const t = getTransporter();
  const info = await t.sendMail({
    from: SMTP_FROM,
    to: to || undefined,
    bcc: ORDER_RECEIVER_EMAIL || undefined,
    subject,
    html,
    text,
    attachments,
  });

  const enableLogger = String(SMTP_LOG).toLowerCase() === 'true';
  const enableDebug  = String(SMTP_DEBUG).toLowerCase() === 'true';
  const quiet        = String(SMTP_QUIET).toLowerCase() === 'true';

  // لو ما فيه لوج تفصيلي، اطبع سطر بسيط فقط (أو ولا شيء لو quiet=true)
  if (!enableLogger && !enableDebug) {
    if (!quiet) console.log('Email sent successfully');
  } else {
    console.log('Email sent:', info.messageId);
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log('Preview URL:', preview);
  }

  return info;
}

module.exports = { sendMail, getTransporter };
