const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

// GET /api/messages/:conversationId?page=&limit= — paginated history.
// Page 1 = newest `limit` messages; returned oldest→newest for direct rendering.
const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '30', 10)));
  const total = await Message.countDocuments({ conversationId: req.conversation._id });
  const docs = await Message.find({ conversationId: req.conversation._id })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  docs.reverse();
  res.json({ messages: docs, page, limit, total, hasMore: page * limit < total });
});

// POST /api/messages { conversationId, content } — sender from JWT, receiver derived.
// The message is stored in MongoDB FIRST; only then returned as sent.
// Phase 5: after persistence, the SAME persisted doc is emitted to both users'
// user:{id} rooms (recipient delivery + sender multi-tab sync). Offline = no-op,
// REST still succeeds; reconnect recovers via REST history (no socket replay).
const send = asyncHandler(async (req, res) => {
  const content = String(req.body.content || '').trim();
  if (!content) throw new AppError('Message content is required.', 400);
  if (content.length > 2000) throw new AppError('Message is too long (max 2000).', 400);

  const conv = req.conversation;
  const receiverId = conv.participants.find((p) => String(p) !== String(req.userId));

  const message = await Message.create({
    conversationId: conv._id,
    senderId: req.userId,
    receiverId,
    content,
    messageType: 'text',
    status: 'sent',
  });

  await Conversation.findByIdAndUpdate(conv._id, {
    lastMessage: message._id,
    lastMessageAt: message.createdAt,
  });

  // Delivery layer: emit the PERSISTED doc (with _id + timestamps), never before save.
  // Emitting to user rooms (not conv rooms) keeps new conversations working without rejoin
  // and reaches every tab/device. Client dedupes by _id against its REST response.
  // Phase 8: sending clears the sender's typing state for this conversation
  // (composer sent => no longer typing). Ephemeral only, no DB involved.
  emitNewMessage(req, conv, message, req.userId, receiverId);

  res.status(201).json({ message });
});

// Shared delivery fan-out: the SAME persisted doc goes to both users' rooms
// (recipient delivery + sender multi-tab sync). Offline = no-op; reconnect
// recovers via REST history. Never called before MongoDB persistence.
function emitNewMessage(req, conv, message, senderId, receiverId) {
  const persisted = message.toObject ? message.toObject() : message;
  try {
    const io = req.app.get('io');
    if (io) {
      const typing = require('../sockets/typing');
      typing.clearUserConv(io, String(conv._id), String(senderId));
      io.to(`user:${String(receiverId)}`).emit('receive_message', { message: persisted });
      io.to(`user:${String(senderId)}`).emit('receive_message', { message: persisted });
      io.to(`user:${String(receiverId)}`).emit('conversation_updated', {
        conversationId: String(conv._id),
        lastMessage: persisted,
      });
      io.to(`user:${String(senderId)}`).emit('conversation_updated', {
        conversationId: String(conv._id),
        lastMessage: persisted,
      });
    }
  } catch (err) {
    // Delivery must never fail the persisted send.
    console.warn('[socket] emit failed:', err.message);
  }
}

// POST /api/messages/image (multipart: conversationId + image file).
// Middleware order in the route: auth -> multer (10MB, MIME gate) ->
// requireParticipant (403 outsiders, reads req.body.conversationId) -> here.
// Flow: magic-byte verify -> Cloudinary -> Message.create (metadata only) ->
// bump lastMessage -> same socket fan-out as text. Text behavior unchanged.
const sendImage = asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    throw new AppError('No image provided. Attach a JPEG, PNG, WebP or GIF image.', 400);
  }

  // Never trust the browser MIME alone: sniff the actual bytes.
  const FileType = require('file-type');
  const sniffed = await FileType.fromBuffer(req.file.buffer);
  const { ALLOWED_IMAGE_MIME } = require('../middleware/uploadImage');
  if (!sniffed || !ALLOWED_IMAGE_MIME.has(sniffed.mime)) {
    throw new AppError('File is not a supported image. Allowed: JPEG, PNG, WebP, GIF.', 400);
  }

  const storage = require('../config/storage');
  if (!storage.isConfigured()) {
    throw new AppError('Image uploads are not configured on the server.', 503);
  }

  const conv = req.conversation;
  const receiverId = conv.participants.find((p) => String(p) !== String(req.userId));

  let uploaded;
  try {
    uploaded = await storage.uploadImageBuffer(req.file.buffer, req.file.originalname);
  } catch (err) {
    console.warn('[storage] upload failed:', err.message);
    throw new AppError('Image could not be stored. Please try again.', 502);
  }

  const safeName = String(req.file.originalname || 'image').slice(0, 100);
  const message = await Message.create({
    conversationId: conv._id,
    senderId: req.userId,
    receiverId,
    messageType: 'image',
    image: {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      filename: safeName,
      mimeType: sniffed.mime,
      size: req.file.size,
      width: uploaded.width || undefined,
      height: uploaded.height || undefined,
    },
    status: 'sent',
  });

  await Conversation.findByIdAndUpdate(conv._id, {
    lastMessage: message._id,
    lastMessageAt: message.createdAt,
  });

  emitNewMessage(req, conv, message, req.userId, receiverId);

  res.status(201).json({ message });
});

module.exports = { list, send, sendImage };
