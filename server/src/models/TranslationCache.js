const mongoose = require('mongoose');

// Translation cache (isolated collection — original Message.content is NEVER modified).
// Unique key messageId + targetLanguage so the same message is never translated twice.
const translationCacheSchema = new mongoose.Schema(
  {
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true, index: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    targetLanguage: { type: String, enum: ['en', 'hi', 'bn', 'ta'], required: true },
    sourceLanguage: { type: String, default: '' }, // e.g. 'bn', 'bn-Latn', 'hi', 'en'
    translatedText: { type: String, required: true, maxlength: 4000 },
    provider: { type: String, default: '' }, // which backend produced it (debug, never secrets)
  },
  { timestamps: true }
);

translationCacheSchema.index({ messageId: 1, targetLanguage: 1 }, { unique: true });

module.exports = mongoose.model('TranslationCache', translationCacheSchema);
