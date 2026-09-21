const asyncHandler = require('../utils/asyncHandler');
const { findOrCreateOneToOne, listForUser, PUBLIC_USER_FIELDS } = require('../services/conversation.service');

// POST /api/conversations { userId } — get-or-create 1-to-1 (200 existing, 201 created).
const create = asyncHandler(async (req, res) => {
  const { conversation, created } = await findOrCreateOneToOne(req.userId, req.body.userId);
  res.status(created ? 201 : 200).json({ conversation });
});

// GET /api/conversations — my conversations, newest activity first.
const list = asyncHandler(async (req, res) => {
  const conversations = await listForUser(req.userId);
  res.json({ conversations });
});

// GET /api/conversations/:id — participant only (requireParticipant ran first).
const getById = asyncHandler(async (req, res) => {
  const conv = await req.conversation.populate('participants', PUBLIC_USER_FIELDS).then((c) => c.populate('lastMessage'));
  res.json({ conversation: conv });
});

module.exports = { create, list, getById };
