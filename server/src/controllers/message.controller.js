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

// POST /api/messages/video (multipart: conversationId + video file).
// Mirrors sendImage: auth -> multer (50MB, video MIME gate) ->
// requireParticipant (403 outsiders) -> here. Differences: magic-byte check
// against the video allowlist, resource_type:'video' upload, duration +
// poster thumbnail metadata, and orphan cleanup if MongoDB fails post-upload.
const sendVideo = asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    throw new AppError('No video provided. Attach an MP4, WebM or QuickTime video.', 400);
  }

  // Never trust the browser MIME alone: sniff the actual bytes.
  const FileType = require('file-type');
  const sniffed = await FileType.fromBuffer(req.file.buffer);
  const { ALLOWED_VIDEO_MIME } = require('../middleware/uploadVideo');
  if (!sniffed || !ALLOWED_VIDEO_MIME.has(sniffed.mime)) {
    throw new AppError('File is not a supported video. Allowed: MP4, WebM, QuickTime.', 400);
  }

  const storage = require('../config/storage');
  if (!storage.isConfigured()) {
    throw new AppError('Video uploads are not configured on the server.', 503);
  }

  const conv = req.conversation;
  const receiverId = conv.participants.find((p) => String(p) !== String(req.userId));

  let uploaded;
  try {
    uploaded = await storage.uploadVideoBuffer(req.file.buffer, req.file.originalname);
  } catch (err) {
    console.warn('[storage] video upload failed:', err.message);
    throw new AppError('Video could not be stored. Please try again.', 502);
  }

  const safeName = String(req.file.originalname || 'video').slice(0, 100);
  let message;
  try {
    message = await Message.create({
      conversationId: conv._id,
      senderId: req.userId,
      receiverId,
      messageType: 'video',
      video: {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        filename: safeName,
        mimeType: sniffed.mime,
        size: req.file.size,
        width: uploaded.width || undefined,
        height: uploaded.height || undefined,
        duration: uploaded.duration || undefined,
        thumbnail: storage.videoThumbnailUrl(uploaded.public_id),
      },
      status: 'sent',
    });
  } catch (err) {
    // Upload succeeded but persistence failed: remove the orphan asset (best-effort),
    // then report a friendly error. Never leave a silent orphan if cleanup is possible.
    try {
      await storage.deleteAsset(uploaded.public_id, 'video');
    } catch (cleanupErr) {
      console.warn('[storage] orphan cleanup failed:', cleanupErr.message);
    }
    console.warn('[message] video persist failed after upload:', err.message);
    throw new AppError('Video could not be saved. Please try again.', 500);
  }

  await Conversation.findByIdAndUpdate(conv._id, {
    lastMessage: message._id,
    lastMessageAt: message.createdAt,
  });

  emitNewMessage(req, conv, message, req.userId, receiverId);

  res.status(201).json({ message });
});

// POST /api/messages/voice (multipart: conversationId + voice file + durationMs).
// Mirrors sendVideo: auth -> multer (10MB, audio MIME gate) ->
// requireParticipant (403 outsiders) -> here. Differences: magic-byte check
// against the voice allowlist, resource_type audio upload, duration from
// Cloudinary (else client elapsed), orphan cleanup if MongoDB fails.
const sendVoice = asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    throw new AppError('No voice recording provided. Record a voice message first.', 400);
  }
  if (req.file.buffer.length === 0) {
    throw new AppError('Empty recording. Record a voice message first.', 400);
  }

  // Never trust the browser MIME alone: sniff the actual bytes.
  const FileType = require('file-type');
  const sniffed = await FileType.fromBuffer(req.file.buffer);
  const { ALLOWED_VOICE_MIME } = require('../middleware/uploadVoice');
  if (!sniffed || !ALLOWED_VOICE_MIME.has(sniffed.mime)) {
    throw new AppError('File is not a supported voice recording.', 400);
  }

  const storage = require('../config/storage');
  if (!storage.isConfigured()) {
    throw new AppError('Voice uploads are not configured on the server.', 503);
  }

  const conv = req.conversation;
  const receiverId = conv.participants.find((p) => String(p) !== String(req.userId));

  // Client elapsed seconds (cross-check only); Cloudinary duration is authoritative.
  let clientSeconds;
  const rawDuration = Number(req.body && req.body.durationMs);
  if (Number.isFinite(rawDuration) && rawDuration > 0 && rawDuration <= 125000) {
    clientSeconds = Math.round(rawDuration / 100) / 10;
  }

  let uploaded;
  try {
    uploaded = await storage.uploadAudioBuffer(req.file.buffer, req.file.originalname);
  } catch (err) {
    console.warn('[storage] voice upload failed:', err.message);
    throw new AppError('Voice message could not be stored. Please try again.', 502);
  }

  const safeName = String(req.file.originalname || 'voice-message').slice(0, 100);
  let message;
  try {
    message = await Message.create({
      conversationId: conv._id,
      senderId: req.userId,
      receiverId,
      messageType: 'voice',
      voice: {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        filename: safeName,
        mimeType: sniffed.mime,
        size: req.file.size,
        duration:
          typeof uploaded.duration === 'number' && uploaded.duration > 0
            ? Math.round(uploaded.duration * 10) / 10
            : clientSeconds,
      },
      status: 'sent',
    });
  } catch (err) {
    // Upload succeeded but persistence failed: remove the orphan (best-effort).
    try {
      await storage.deleteAsset(uploaded.public_id, 'video');
    } catch (cleanupErr) {
      console.warn('[storage] orphan cleanup failed:', cleanupErr.message);
    }
    console.warn('[message] voice persist failed after upload:', err.message);
    throw new AppError('Voice message could not be saved. Please try again.', 500);
  }

  await Conversation.findByIdAndUpdate(conv._id, {
    lastMessage: message._id,
    lastMessageAt: message.createdAt,
  });

  emitNewMessage(req, conv, message, req.userId, receiverId);

  res.status(201).json({ message });
});

module.exports = { list, send, sendImage, sendVideo, sendVoice };
