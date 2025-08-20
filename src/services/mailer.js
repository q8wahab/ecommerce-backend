// services/mailer.js
const nodemailer = require('nodemailer');

const {
  SMTP_HOST = 'smtp.ethereal.email',
  SMTP_PORT = '587',
  SMTP_SECURE = 'false', // true لمنفذ 465 (SSL). لـ 587 يكون STARTTLS
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM = '24ozKw Store <noreply@24ozkw.com>',
  // 👇 افتراضي دائم لبريدك كـ BCC
  ORDER_RECEIVER_EMAIL = '24ozkw@gmail.com',
} = process.env;

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure:
      String(SMTP_SECURE).toLowerCase() === 'true' ||
      Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    logger: true, // اطبع لوجات SMTP
    debug: true,  // Debug من Nodemailer
  });

  return transporter;
}

/**
 * إرسال إيميل عام — يدعم إرسال بدون "to" (يرسل فقط BCC لك)
 * @param {object} opts
 * @param {string} [opts.to]           بريد العميل (اختياري)
 * @param {string} [opts.subject]
 * @param {string} [opts.html]
 * @param {string} [opts.text]
 * @param {Array}  [opts.attachments]
 * @param {string} [opts.replyTo]      افتراضيًا بريد العميل لو متوفر
 */
async function sendMail({ to, subject, html, text, attachments, replyTo } = {}) {
  const t = getTransporter();

  const info = await t.sendMail({
    from: SMTP_FROM,
    to: to || undefined,                         // ممكن يكون فاضي (سيرسل فقط BCC)
    bcc: ORDER_RECEIVER_EMAIL || undefined,      // نسخة لك دائمًا
    replyTo: replyTo || to || undefined,         // خلّ الرد يروح للعميل إن وُجد
    subject,
    html,
    text,
    attachments,
  });

  console.log('Email sent:', info.messageId);

  // لو Ethereal، يطلع URL للمعاينة
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) console.log('Preview URL:', preview);

  return info;
}

module.exports = { sendMail, getTransporter };
