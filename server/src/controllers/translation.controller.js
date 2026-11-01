const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const TranslationCache = require('../models/TranslationCache');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { detectLanguage, translateText, SUPPORTED } = require('../services/translation.service');

const MAX_LEN = 2000;

// POST /api/translation/translate { messageId, targetLanguage }
// Backend-only translation: the original message is NEVER modified.
// Auth + conversation-membership verified; per-(messageId,targetLanguage) cache
// avoids repeat provider calls. Failures degrade gracefully (502 + friendly
// message) so chat is never blocked.
const translate = asyncHandler(async (req, res) => {
  const { messageId, targetLanguage } = req.body || {};
  if (!messageId || !mongoose.Types.ObjectId.isValid(String(messageId))) {
    throw new AppError('Invalid message id.', 400);
  }
  if (!SUPPORTED.includes(targetLanguage)) {
    throw new AppError('Unsupported target language. Use en, hi, bn or ta.', 400);
  }

  const message = await Message.findById(messageId).lean();
  if (!message) throw new AppError('Message not found.', 404);
  if (message.messageType !== 'text' || !message.content) {
    throw new AppError('Only text messages can be translated.', 400);
  }
  if (String(message.content).length > MAX_LEN) {
    throw new AppError('Message is too long to translate.', 400);
  }

  // Membership: the requester must belong to the message's conversation.
  const conv = await Conversation.findById(message.conversationId).select('participants').lean();
  if (!conv) throw new AppError('Conversation not found.', 404);
  const member = (conv.participants || []).some((p) => String(p) === String(req.userId));
  if (!member) throw new AppError('You are not authorized to access this conversation.', 403);

  // Cache first (unique key messageId + targetLanguage).
  const cached = await TranslationCache.findOne({ messageId: message._id, targetLanguage }).lean();
  if (cached) {
    return res.json({
      messageId: String(message._id),
      sourceLanguage: cached.sourceLanguage,
      targetLanguage,
      translatedText: cached.translatedText,
      isTranslated: true,
      cached: true,
    });
  }

  const detected = detectLanguage(message.content);
  const sourceTag = detected.script === 'latn' && detected.code !== 'en' ? `${detected.code}-Latn` : detected.code;

  let result;
  try {
    result = await translateText(message.content, { source: detected.code, script: detected.script, target: targetLanguage });
  } catch (err) {
    // Low-confidence romanized input: honest message instead of nonsense.
    // (Existing retry/error UI handles this; chat is never blocked.)
    if (err && err.code === 'UNRELIABLE_SOURCE') {
      return res.status(502).json({ isTranslated: false, error: "Couldn't determine the source language." });
    }
    console.warn('[translation] provider chain failed:', err.message);
    return res.status(502).json({ isTranslated: false, error: 'Translation temporarily unavailable.' });
  }

  if (result.sameLanguage) {
    return res.json({
      messageId: String(message._id),
      sourceLanguage: sourceTag,
      targetLanguage,
      translatedText: message.content,
      isTranslated: false,
      sameLanguage: true,
      sourceForm: result.sourceForm || 'native',
      confidence: result.confidence ?? 1,
    });
  }

  // Best-effort cache write (race-safe via unique index; never fails the request).
  try {
    await TranslationCache.updateOne(
      { messageId: message._id, targetLanguage },
      {
        $set: {
          conversationId: message.conversationId,
          sourceLanguage: sourceTag,
          translatedText: result.translatedText,
          provider: result.provider || '',
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.warn('[translation] cache write failed:', err.message);
  }

  return res.json({
    messageId: String(message._id),
    sourceLanguage: sourceTag,
    targetLanguage,
    translatedText: result.translatedText,
    isTranslated: true,
    sourceForm: result.sourceForm || 'native',
    confidence: result.confidence ?? 0.8,
  });
});

module.exports = { translate };
