const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const AppError = require('../utils/AppError');

const PUBLIC_USER_FIELDS = '_id name username avatar bio isOnline lastSeen';

// Find-or-create the 1-to-1 conversation between me and otherId.
// Throws 400 on self-chat, 404 if the other user does not exist.
async function findOrCreateOneToOne(myId, otherId) {
  if (String(myId) === String(otherId)) {
    throw new AppError('You cannot create a conversation with yourself.', 400);
  }
  if (!mongoose.Types.ObjectId.isValid(otherId)) {
    throw new AppError('Invalid user id.', 400);
  }
  const User = require('../models/User');
  const other = await User.findById(otherId).select('_id');
  if (!other) {
    throw new AppError('User not found.', 404);
  }
  const { participants, pairKey } = Conversation.buildPair(myId, otherId);
  let conv = await Conversation.findOne({ pairKey })
    .populate('participants', PUBLIC_USER_FIELDS)
    .populate('lastMessage');
  if (conv) return { conversation: conv, created: false };
  try {
    conv = await Conversation.create({ participants, pairKey });
  } catch (err) {
    // Race: two parallel creates → second hits unique pairKey → return the winner.
    if (err && err.code === 11000) {
      conv = await Conversation.findOne({ pairKey })
        .populate('participants', PUBLIC_USER_FIELDS)
        .populate('lastMessage');
      return { conversation: conv, created: false };
    }
    throw err;
  }
  conv = await Conversation.findById(conv._id)
    .populate('participants', PUBLIC_USER_FIELDS)
    .populate('lastMessage');
  return { conversation: conv, created: true };
}

async function listForUser(myId) {
  const convs = await Conversation.find({ participants: myId })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .populate('participants', PUBLIC_USER_FIELDS)
    .populate('lastMessage')
    .lean();
  // Phase 10: unread counts derived from existing receipt state —
  // my received messages not yet read. No new collection, no schema change.
  // Reloads/reconnects reconstruct counts from this persisted truth.
  if (convs.length === 0) return convs;
  const Message = require('../models/Message');
  const counts = await Message.aggregate([
    {
      $match: {
        conversationId: { $in: convs.map((c) => c._id) },
        receiverId: new mongoose.Types.ObjectId(String(myId)),
        status: { $ne: 'read' },
      },
    },
    { $group: { _id: '$conversationId', count: { $sum: 1 } } },
  ]);
  const byConv = new Map(counts.map((r) => [String(r._id), r.count]));
  convs.forEach((c) => {
    c.unreadCount = byConv.get(String(c._id)) || 0;
  });
  return convs;
}

module.exports = { findOrCreateOneToOne, listForUser, PUBLIC_USER_FIELDS };
