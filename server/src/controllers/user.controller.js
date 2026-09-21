const mongoose = require('mongoose');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

// Public projection — NEVER email, passwordHash, or precise lastSeen.
// Matches approved architecture: _id, name, username, avatar, bio, isOnline (+ createdAt for profiles).
const PUBLIC_FIELDS = '_id name username avatar bio isOnline createdAt';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/users/search?q= — auth required. Search username + display name.
// Frontend debounces + min 2 chars; backend caps at 20, excludes self.
const searchUsers = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) {
    return res.json({ users: [] });
  }
  if (q.length > 30) {
    throw new AppError('Search query is too long.', 400);
  }
  const rx = new RegExp(escapeRegex(q), 'i');
  const users = await User.find({
    _id: { $ne: req.userId },
    $or: [{ username: rx }, { name: rx }],
  })
    .select(PUBLIC_FIELDS)
    .limit(20)
    .lean();
  res.json({ users });
});

// GET /api/users/:id — auth required. Public profile only.
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('User not found.', 404);
  }
  const user = await User.findById(id).select(PUBLIC_FIELDS).lean();
  if (!user) {
    throw new AppError('User not found.', 404);
  }
  res.json({ user });
});

// PATCH /api/users/profile — auth required. Own profile only (req.userId).
// Whitelist: name + bio only. Avatar stays placeholder (no uploads in Phase 3).
const updateMyProfile = asyncHandler(async (req, res) => {
  const updates = {};
  if (req.body.name !== undefined) {
    const name = String(req.body.name || '').trim();
    if (!name) throw new AppError('Name is required.', 400);
    if (name.length > 50) throw new AppError('Name is too long.', 400);
    updates.name = name;
  }
  if (req.body.bio !== undefined) {
    const bio = String(req.body.bio || '');
    if (bio.length > 200) throw new AppError('Bio is too long (max 200).', 400);
    updates.bio = bio;
  }
  if (Object.keys(updates).length === 0) {
    throw new AppError('Nothing to update. Provide name and/or bio.', 400);
  }
  const user = await User.findByIdAndUpdate(req.userId, updates, {
    new: true,
    runValidators: true,
  }).select(PUBLIC_FIELDS).lean();
  if (!user) {
    throw new AppError('Not authorized. Please log in.', 401);
  }
  res.json({ user });
});

module.exports = { searchUsers, getUserById, updateMyProfile };
