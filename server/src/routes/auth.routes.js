const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const { register, login, me, logout } = require('../controllers/auth.controller');

const router = express.Router();

// Why rate limit auth: slows brute-force login + mass registration. Friendly 429 afterwards.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
});

// Shared: turn express-validator failures into a single friendly { message }.
function validate(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({ message: errors.array()[0].msg });
}

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required.').isLength({ max: 50 }).withMessage('Name is too long.'),
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required.')
    .isLength({ min: 3, max: 20 }).withMessage('Username must be 3–20 characters.')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username may only contain letters, numbers and underscore.')
    .toLowerCase(),
  body('email').trim().notEmpty().withMessage('Email is required.').isEmail().withMessage('Please provide a valid email address.').normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.'),
];

const loginRules = [
  body('identifier').trim().notEmpty().withMessage('Email or username is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
];

router.post('/register', authLimiter, registerRules, validate, register);
router.post('/login', authLimiter, loginRules, validate, login);
router.post('/logout', logout);
router.get('/me', auth, me);

module.exports = router;
