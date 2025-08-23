// scripts/test-wa.js
require('dotenv').config();
const twilio = require('twilio');

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_MESSAGING_SERVICE_SID,
  WHATSAPP_ORDER_TEMPLATE_SID
} = process.env;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_MESSAGING_SERVICE_SID || !WHATSAPP_ORDER_TEMPLATE_SID) {
  console.error('Missing one or more env vars for WhatsApp (check .env).');
  process.exit(1);
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Helper: Kuwait local 8-digit -> E.164
const toWhatsApp = (raw) => {
  const digits = String(raw).replace(/\D/g, '');
  const e164 = digits.length === 8 ? `+965${digits}` : (digits.startsWith('+') ? digits : `+${digits}`);
  return `whatsapp:${e164}`;
};

(async () => {
  try {
    const res = await client.messages.create({
      to: toWhatsApp('99797710'), // CHANGE to your test recipient
      messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
      contentSid: WHATSAPP_ORDER_TEMPLATE_SID,
      contentVariables: JSON.stringify({
        // Match your template exactly (your English version with {{1}}..{{7}})
        "1": "Wahab",                         // name
        "2": "INV-2025-00123",                // order id
        "3": "27.500",                        // total
        "4": "KWD",                           // currency
        "5": "Cash on delivery",              // payment method
        "6": "Salmiya, Blk 5, St 10, House 8",// shipping address
        "7": "Tomorrow 5–8 PM"                // ETA
        // add "8" if your template has a CTA link variable
      })
    });
    console.log('Template sent. Message SID:', res.sid);
  } catch (err) {
    console.error('Send failed:', err.status, err.code, err.message);
    if (err.moreInfo) console.error('More info:', err.moreInfo);
  }
})();
