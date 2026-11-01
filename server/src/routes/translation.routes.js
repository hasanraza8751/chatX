const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const { translate } = require('../controllers/translation.controller');

const router = express.Router();
router.use(auth);

// Translation calls paid/free external providers: per-user rate limit so one
// client cannot exhaust quota. In-memory store (single-process dev + prod parity
// with the rest of the app, which holds presence/typing in memory).
const translateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.userId || req.ip),
  handler: (req, res) => {
    res.status(429).json({ isTranslated: false, error: 'Too many translation requests. Try again later.' });
  },
});

function validate(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({ message: errors.array()[0].msg });
}

router.post(
  '/translate',
  translateLimiter,
  body('messageId').notEmpty().withMessage('messageId is required.').isMongoId().withMessage('Invalid message id.'),
  body('targetLanguage').notEmpty().withMessage('targetLanguage is required.'),
  validate,
  translate
);

module.exports = router;
