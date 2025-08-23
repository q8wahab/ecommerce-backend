// src/services/whatsapp.js
const twilio = require('twilio');

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_MESSAGING_SERVICE_SID, // مفضّل
  TWILIO_WHATSAPP_FROM,          // بديل إذا ما عندك Messaging Service
  WHATSAPP_DEFAULT_COUNTRY_CODE = '965',

  // اسم المتغيّر اللي عندك
  WHATSAPP_ORDER_TEMPLATE_SID,

  // احتياطيًا لو كنت تستخدم اسم قديم
  TWILIO_WHATSAPP_CONTENT_SID,
  TWILIO_STATUS_CALLBACK, // اختياري
} = process.env;

const CONTENT_SID = WHATSAPP_ORDER_TEMPLATE_SID || TWILIO_WHATSAPP_CONTENT_SID;

let client;
function getClient() {
  if (!client) {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials are missing');
    }
    client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return client;
}

/**
 * يحوّل رقم محلي 8 أرقام إلى +E164 باستخدام كود الدولة، أو يمرّر +E164 كما هو.
 * مثال: "51234567" -> "+96551234567"
 */
function toWhatsAppE164(phone) {
  const raw = String(phone || '');
  if (raw.startsWith('+')) return raw;

  const digits = raw.replace(/\D/g, '');
  const cc = String(WHATSAPP_DEFAULT_COUNTRY_CODE || '965').replace(/\D/g, '');

  if (digits.startsWith(cc)) return `+${digits}`;
  if (digits.length === 8) return `+${cc}${digits}`;
  return `+${digits}`;
}

/**
 * إرسال رسالة واتساب باستخدام قالب Content (HX…)
 * vars: كائن مفاتيحه "1","2","3"... تطابق متغيرات القالب.
 * مثال:
 *   vars = { "1":"Wahab", "2":"INV-123", "3":"12.500", "4":"KWD", "5":"Cash", "6":"...", "7":"..." }
 */
async function sendOrderWhatsApp({ toE164, vars = {}, statusCallback }) {
  if (!CONTENT_SID) {
    throw new Error('WHATSAPP_ORDER_TEMPLATE_SID is missing');
  }
  if (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_WHATSAPP_FROM) {
    throw new Error('Provide TWILIO_MESSAGING_SERVICE_SID or TWILIO_WHATSAPP_FROM');
  }

  const to = toE164.startsWith('whatsapp:')
    ? toE164
    : `whatsapp:${toE164}`;

  const payload = {
    to,
    contentSid: CONTENT_SID,
    contentVariables: JSON.stringify(vars),
  };

  if (TWILIO_MESSAGING_SERVICE_SID) {
    payload.messagingServiceSid = TWILIO_MESSAGING_SERVICE_SID;
  } else {
    // يسمح لك باستخدام رقم sandbox/المرسل مباشرة
    const from = (TWILIO_WHATSAPP_FROM || '').replace(/^whatsapp:/, '');
    payload.from = `whatsapp:${from}`;
  }

  if (statusCallback || TWILIO_STATUS_CALLBACK) {
    payload.statusCallback = statusCallback || TWILIO_STATUS_CALLBACK;
  }

  return getClient().messages.create(payload);
}

module.exports = {
  toWhatsAppE164,
  sendOrderWhatsApp,
};
