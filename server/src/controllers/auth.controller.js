const bcrypt = require('bcryptjs');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { setAuthCookie, clearAuthCookie } = require('../utils/tokens');

// Approved cost factor: 12 (secure + reasonable speed for learning/dev).
const BCRYPT_COST = 12;

// POST /api/auth/register — { name, username, email, password }
// Why bcryptjs: pure JS (no native build issues), strong salted hash.
// Plaintext password is NEVER stored or logged — only passwordHash reaches MongoDB.
const register = asyncHandler(async (req, res) => {
  const { name, username, email, password } = req.body;

  const normalizedUsername = String(username || '').trim().toLowerCase();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  // Friendly duplicates (also enforced by unique indexes against race conditions).
  const existingUser = await User.findOne({
    $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
  });
  if (existingUser) {
    if (existingUser.email === normalizedEmail) {
      throw new AppError('Email is already registered.', 409);
    }
    throw new AppError('Username is already taken.', 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await User.create({
    name: String(name || '').trim(),
    username: normalizedUsername,
    email: normalizedEmail,
    passwordHash,
  });

  setAuthCookie(res, user._id);
  res.status(201).json({ user: user.toSafeJSON() });
});

// POST /api/auth/login — { identifier, password } (identifier = email OR username).
const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  const id = String(identifier || '').trim().toLowerCase();

  // +passwordHash explicitly opts into the select:false field for compare only.
  const user = await User.findOne({
    $or: [{ email: id }, { username: id }],
  }).select('+passwordHash');

  if (!user) {
    throw new AppError('Invalid email/username or password.', 401);
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new AppError('Invalid email/username or password.', 401);
  }

  setAuthCookie(res, user._id);
  // Re-fetch without hash for the safe response (or strip manually).
  const safe = await User.findById(user._id);
  res.json({ user: safe.toSafeJSON() });
});

// GET /api/auth/me — persistent login (reads httpOnly cookie via auth middleware).
const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    throw new AppError('Not authorized. Please log in.', 401);
  }
  res.json({ user: user.toSafeJSON() });
});

// POST /api/auth/logout — clears the cookie with matching path/sameSite/secure.
const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Logged out successfully.' });
});

module.exports = { register, login, me, logout };
