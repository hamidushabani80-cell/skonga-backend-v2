/**
 * src/routes/feedback.js
 * POST /api/feedback → logs user feedback (phase 1: console only).
 */
const express = require('express');
const router = express.Router();

router.post('/feedback', (req, res) => {
  const { type, message, ts } = req.body || {};
  console.log(`[FEEDBACK] ${type} @ ${new Date(ts || Date.now()).toISOString()}: ${(message || '').slice(0, 200)}`);
  res.json({ ok: true });
});

module.exports = router;
