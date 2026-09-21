const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const AppError = require('../utils/AppError');

// Loads the conversation + enforces participant-only access.
// Used by conversation detail AND all message routes (backend authorization).
async function requireParticipant(req, res, next) {
  const id = req.params.id || req.params.conversationId || (req.body && req.body.conversationId);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid conversation id.', 400));
  }
  const conv = await Conversation.findById(id);
  if (!conv) {
    return next(new AppError('Conversation not found.', 404));
  }
  const isMember = conv.participants.some((p) => String(p) === String(req.userId));
  if (!isMember) {
    return next(new AppError('You are not authorized to access this conversation.', 403));
  }
  req.conversation = conv;
  return next();
}

module.exports = requireParticipant;
