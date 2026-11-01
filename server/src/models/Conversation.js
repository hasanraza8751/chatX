const mongoose = require('mongoose');

// 1-to-1 only (Phase 4). participants always exactly 2, stored sorted.
// pairKey = "smallerId_largerId" with a unique index — the DB-level guard
// against duplicate conversations between the same two users (plus app-level check).
const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length === 2,
        message: 'A conversation must contain exactly two participants.',
      },
    },
    pairKey: { type: String, required: true, unique: true },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    lastMessageAt: { type: Date, default: null },
    // Per-conversation translation target overrides (isolated, optional).
    // Each entry lets ONE participant override their global language preference
    // for THIS conversation only. Absent entry => global preference applies.
    languageOverrides: {
      type: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
          targetLanguage: { type: String, enum: ['en', 'hi', 'bn', 'ta'], required: true },
        },
      ],
      default: undefined,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

// Sort + build the deterministic key. Called by the service before save.
conversationSchema.statics.buildPair = function (idA, idB) {
  const sorted = [String(idA), String(idB)].sort();
  return { participants: sorted, pairKey: sorted[0] + '_' + sorted[1] };
};

module.exports = mongoose.model('Conversation', conversationSchema);
