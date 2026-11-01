const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
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

// PATCH /api/conversations/:id/language { targetLanguage: 'en'|..|null }
// Participant only (requireParticipant ran first). Sets or clears MY
// per-conversation translation target override. Global preference applies
// when no override exists. Small additive endpoint for the translation feature.
const setLanguageOverride = asyncHandler(async (req, res) => {
  const LANGS = ['en', 'hi', 'bn', 'ta'];
  const { targetLanguage } = req.body || {};
  if (targetLanguage !== null && targetLanguage !== undefined && !LANGS.includes(targetLanguage)) {
    throw new AppError('Unsupported target language. Use en, hi, bn, ta or null.', 400);
  }
  const conv = req.conversation;
  conv.languageOverrides = (conv.languageOverrides || []).filter(
    (o) => String(o.userId) !== String(req.userId)
  );
  if (targetLanguage) {
    conv.languageOverrides.push({ userId: req.userId, targetLanguage });
  }
  await conv.save();
  res.json({ conversationId: String(conv._id), languageOverrides: conv.languageOverrides || [] });
});

module.exports = { create, list, getById, setLanguageOverride };
