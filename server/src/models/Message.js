const mongoose = require('mongoose');

// Phase 4: persistent TEXT messages. Phase 9A adds IMAGE messages.
// A message counts as "sent" only after this document exists in MongoDB.
// Binary image data is NEVER stored here — only URL + metadata (Cloudinary holds bytes).
const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, trim: true, maxlength: 2000 }, // required for text (see pre-validate)
    messageType: { type: String, enum: ['text', 'image'], default: 'text' },
    image: {
      url: { type: String },
      publicId: { type: String },
      filename: { type: String },
      mimeType: { type: String },
      size: { type: Number },
      width: { type: Number },
      height: { type: Number },
    },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  },
  { timestamps: true }
);

// Conditional requiredness: text needs content, image needs a stored reference.
// (Controller validation runs first with friendly errors; this is the DB-level guard.)
messageSchema.pre('validate', function (next) {
  if (this.messageType === 'text' && !this.content) {
    return next(new Error('Message content is required.'));
  }
  if (this.messageType === 'image' && !(this.image && this.image.url)) {
    return next(new Error('Image reference is required.'));
  }
  next();
});

// Ordering + pagination (one conversation's history, oldest→newest via sort).
messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ receiverId: 1, status: 1 });

module.exports = mongoose.model('Message', messageSchema);
