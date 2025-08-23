// src/routes/whatsapp.routes.js
const express = require('express');
const router = express.Router();
const { sendOrderConfirmationText, sendOrderConfirmationContent } = require('../services/whatsapp');

// اختبار سريع بإرسال رسالة قالب نصّي (استبدل القيم في البودي)
router.post('/send-test', async (req, res) => {
  try {
    const { to, name, orderId, total, shipping, useContentApi, vars } = req.body;

    let result;
    if (useContentApi) {
      // إرسال عبر Content API
      result = await sendOrderConfirmationContent({ to, vars });
    } else {
      // إرسال نصي
      result = await sendOrderConfirmationText({
        to,
        name,
        orderId,
        totalKwd: total,
        shippingKwd: shipping,
      });
    }

    res.json({ success: true, sid: result.sid, status: result.status });
  } catch (err) {
    console.error('[whatsapp/send-test]', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ويبهوك الرسائل الواردة من واتساب عبر Twilio
router.post('/webhook', async (req, res) => {
  try {
    // Twilio يرسل باراميترات مثل: Body, From, WaId, ProfileName ...
    // ممكن تحفظها أو ترد عليها حسب منطقك
    console.log('[whatsapp/incoming]', req.body);

    // ردّ 200 بسرعة (Twilio لا يحتاج محتوى محدد)
    res.status(200).send('OK');
  } catch (err) {
    console.error('[whatsapp/webhook]', err);
    res.status(500).send('ERROR');
  }
});

// ويبهوك حالات التسليم (status callbacks)
router.post('/status', async (req, res) => {
  try {
    // باراميترات متوقعة: MessageStatus, MessageSid, ErrorCode, ErrorMessage ...
    console.log('[whatsapp/status]', req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error('[whatsapp/status]', err);
    res.status(500).send('ERROR');
  }
});

module.exports = router;
