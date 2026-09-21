const mongoose = require('mongoose');

// Phase 4: persistent TEXT messages. Phase 9A IMAGE, 9B VIDEO, 9C VOICE.
// A message counts as "sent" only after this document exists in MongoDB.
// Binary media is NEVER stored here — only URL + metadata (Cloudinary holds bytes).
const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, trim: true, maxlength: 2000 }, // required for text (see pre-validate)
    messageType: { type: String, enum: ['text', 'image', 'video', 'voice'], default: 'text' },
    image: {
      url: { type: String },
      publicId: { type: String },
      filename: { type: String },
      mimeType: { type: String },
      size: { type: Number },
      width: { type: Number },
      height: { type: Number },
    },
    video: {
      url: { type: String },
      publicId: { type: String },
      filename: { type: String },
      mimeType: { type: String },
      size: { type: Number },
      width: { type: Number },
      height: { type: Number },
      duration: { type: Number }, // seconds (from Cloudinary)
      thumbnail: { type: String }, // poster .jpg URL (from Cloudinary)
    },
    voice: {
      url: { type: String },
      publicId: { type: String },
      filename: { type: String },
      mimeType: { type: String }, // server-sniffed container type
      size: { type: Number }, // bytes
      duration: { type: Number }, // seconds (Cloudinary, else client elapsed)
    },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    // Phase 9D: reply quote snapshot (denormalized so history/socket payloads
    // carry the quote with zero extra queries; no deletion feature exists to stale it).
    replyTo: {
      messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      senderName: { type: String },
      messageType: { type: String },
      excerpt: { type: String },
      mediaUrl: { type: String },
      thumbnail: { type: String },
    },
  },
  { timestamps: true }
);

// Conditional requiredness: text needs content, media needs a stored reference.
// (Controller validation runs first with friendly errors; this is the DB-level guard.)
messageSchema.pre('validate', function (next) {
  if (this.messageType === 'text' && !this.content) {
    return next(new Error('Message content is required.'));
  }
  if (this.messageType === 'image' && !(this.image && this.image.url)) {
    return next(new Error('Image reference is required.'));
  }
  if (this.messageType === 'video' && !(this.video && this.video.url)) {
    return next(new Error('Video reference is required.'));
  }
  if (this.messageType === 'voice' && !(this.voice && this.voice.url)) {
    return next(new Error('Voice reference is required.'));
  }
  next();
});

// Ordering + pagination (one conversation's history, oldest→newest via sort).
messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ receiverId: 1, status: 1 });

module.exports = mongoose.model('Message', messageSchema);
