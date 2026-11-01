const mongoose = require('mongoose');

// Approved schema (MVP): auth + profile + presence only.
// passwordHash is select:false so it NEVER leaks via queries unless explicitly requested.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: [/^[a-z0-9_]+$/, 'Username may only contain letters, numbers and underscore.'],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address.'],
    },
    passwordHash: { type: String, required: true, select: false },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 200 },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: null },
    // Translation preferences (isolated feature; defaults keep old behavior).
    // preferredLanguage: recipient language used as the default translation target.
    // translationMode: 'off' | 'ask' | 'auto'. translationTarget overrides the
    // target when set, otherwise preferredLanguage is used.
    preferredLanguage: { type: String, enum: ['en', 'hi', 'bn', 'ta'], default: 'en' },
    translationMode: { type: String, enum: ['off', 'ask', 'auto'], default: 'off' },
    translationTarget: { type: String, enum: ['en', 'hi', 'bn', 'ta'], default: null },
  },
  { timestamps: true }
);

// Explicit indexes (unique already creates one; text index powers Phase 3 search).
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });

// Safe projection: ONLY these fields ever leave the backend.
userSchema.statics.safeFields = '_id name username email avatar bio isOnline lastSeen preferredLanguage translationMode translationTarget createdAt updatedAt';
userSchema.methods.toSafeJSON = function () {
  return {
    _id: this._id,
    name: this.name,
    username: this.username,
    email: this.email,
    avatar: this.avatar,
    bio: this.bio,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
    preferredLanguage: this.preferredLanguage || 'en',
    translationMode: this.translationMode || 'off',
    translationTarget: this.translationTarget || null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('User', userSchema);
