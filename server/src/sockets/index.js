const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const env = require('../config/env');
const { COOKIE_NAME } = require('../config/cookies');
const presence = require('./presence');
const typing = require('./typing');

// Phase 7A: cookie auth (unchanged) + user room + participant-only conv rooms
// + online/offline presence. Delivery still uses user:{id} rooms.
// Presence events carry ONLY { userId } / { userId, lastSeen } — no JWT, no secrets.
// Phase 7B: receiver-only delivery acks (sent -> delivered, idempotent).
// Phase 7C: receiver-only read acks (sent|delivered -> read, idempotent, never backward).
async function getPartnerIds(userId) {
  const Conversation = require('../models/Conversation');
  const convs = await Conversation.find({ participants: userId }).select('participants').lean();
  const partners = new Set();
  convs.forEach((c) => {
    (c.participants || []).forEach((p) => {
      if (String(p) !== String(userId)) partners.add(String(p));
    });
  });
  return [...partners];
}

function initSockets(io) {
  io.use((socket, next) => {
    try {
      const raw = socket.handshake.headers.cookie || '';
      const parsed = cookie.parse(raw);
      const token = parsed[COOKIE_NAME];
      if (!token) {
        return next(new Error('Not authorized. Please log in.'));
      }
      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.userId = decoded.id;
      return next();
    } catch (err) {
      return next(new Error('Session expired. Please log in again.'));
    }
  });

  io.on('connection', (socket) => {
    if (!socket.userId) return;
    const userId = String(socket.userId);

    // Join synchronously so bookkeeping can't race rapid connect/disconnect.
    socket.join(`user:${userId}`);
    const becameOnline = presence.addSocket(userId, socket.id);

    (async () => {
      try {
        const Conversation = require('../models/Conversation');
        const convs = await Conversation.find({ participants: userId }).select('_id').lean();
        convs.forEach((c) => socket.join(`conv:${c._id}`));
      } catch (err) {
        console.warn('[socket] conv room join failed:', err.message);
      }
      // Persist + notify partners only on the 0 -> 1 transition (multi-tab safe).
      if (becameOnline) {
        try {
          const User = require('../models/User');
          await User.findByIdAndUpdate(userId, { isOnline: true });
          const partners = await getPartnerIds(userId);
          partners.forEach((pid) => io.to(`user:${pid}`).emit('user_online', { userId }));
        } catch (err) {
          console.warn('[socket] online broadcast failed:', err.message);
        }
      }
      console.log(`[socket] connected: ${socket.id} user=${userId}`);
    })();

    // Phase 7B: delivery acknowledgment. ONLY the message receiver may ack,
    // and only for a message that belongs to the stated conversation.
    // sent -> delivered is the sole transition; repeats are harmless no-ops.
    socket.on('message_delivered', async ({ messageId, conversationId } = {}) => {
      try {
        const mongoose = require('mongoose');
        if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) return;
        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) return;
        const Message = require('../models/Message');
        const msg = await Message.findById(messageId);
        if (!msg) return;
        if (String(msg.receiverId) !== userId) return; // sender/outsider cannot ack
        if (String(msg.conversationId) !== String(conversationId)) return; // wrong conversation
        if (msg.status !== 'sent') return; // idempotent: already delivered (or read later)
        msg.status = 'delivered';
        await msg.save();
        io.to(`user:${String(msg.senderId)}`).emit('message_delivered', {
          messageId: String(msg._id),
          conversationId: String(msg.conversationId),
          status: 'delivered',
        });
      } catch (err) {
        console.warn('[socket] delivery ack failed:', err.message);
      }
    });

    // Phase 7C: read acknowledgment. Same authorization as delivery.
    // Allowed: sent -> read, delivered -> read. Never backward, repeats are no-ops.
    socket.on('message_read', async ({ messageId, conversationId } = {}) => {
      try {
        const mongoose = require('mongoose');
        if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) return;
        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) return;
        const Message = require('../models/Message');
        const msg = await Message.findById(messageId);
        if (!msg) return;
        if (String(msg.receiverId) !== userId) return; // sender/outsider cannot ack
        if (String(msg.conversationId) !== String(conversationId)) return; // wrong conversation
        if (msg.status === 'read') return; // idempotent
        if (msg.status !== 'sent' && msg.status !== 'delivered') return; // no backward transition
        msg.status = 'read';
        await msg.save();
        io.to(`user:${String(msg.senderId)}`).emit('message_read', {
          messageId: String(msg._id),
          conversationId: String(msg.conversationId),
          status: 'read',
        });
      } catch (err) {
        console.warn('[socket] read ack failed:', err.message);
      }
    });

    // Phase 10: bulk read on conversation open. Marks ALL my received
    // sent|delivered messages in the conversation as read (same rules as 7C,
    // participant-checked, receiver-only, idempotent) and notifies ONLY the
    // other participant(s) so sender ticks update. No global broadcast.
    socket.on('conversation_read', async ({ conversationId } = {}) => {
      try {
        const mongoose = require('mongoose');
        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) return;
        const Conversation = require('../models/Conversation');
        const conv = await Conversation.findById(conversationId).select('participants').lean();
        if (!conv) return;
        const member = (conv.participants || []).some((p) => String(p) === userId);
        if (!member) return; // outsider cannot clear anyone's unread state
        const Message = require('../models/Message');
        const res = await Message.updateMany(
          {
            conversationId: conv._id,
            receiverId: new mongoose.Types.ObjectId(userId),
            status: { $in: ['sent', 'delivered'] },
          },
          { $set: { status: 'read' } }
        );
        if (!res.modifiedCount) return; // nothing unread: stay silent
        (conv.participants || [])
          .map(String)
          .filter((p) => p !== userId)
          .forEach((pid) =>
            io.to(`user:${pid}`).emit('conversation_read', {
              conversationId: String(conv._id),
              readerId: userId,
            })
          );
      } catch (err) {
        console.warn('[socket] conversation_read failed:', err.message);
      }
    });

    // Phase 8: typing indicators. Authenticated + participant-only, ephemeral
    // (never persisted). Only the OTHER participants are notified.
    const verifyTyping = async (conversationId) => {
      const mongoose = require('mongoose');
      if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) return null;
      const Conversation = require('../models/Conversation');
      const conv = await Conversation.findById(conversationId).select('participants').lean();
      if (!conv) return null;
      const member = (conv.participants || []).some((p) => String(p) === userId);
      if (!member) return null;
      return {
        convId: String(conv._id),
        others: (conv.participants || []).map(String).filter((p) => p !== userId),
      };
    };
    socket.on('typing_start', async ({ conversationId } = {}) => {
      try {
        const ctx = await verifyTyping(conversationId);
        if (!ctx) return;
        typing.start(io, ctx.convId, userId, socket.id, ctx.others);
      } catch (err) {
        console.warn('[socket] typing_start failed:', err.message);
      }
    });
    socket.on('typing_stop', async ({ conversationId } = {}) => {
      try {
        const ctx = await verifyTyping(conversationId);
        if (!ctx) return;
        typing.stop(io, ctx.convId, userId, socket.id);
      } catch (err) {
        console.warn('[socket] typing_stop failed:', err.message);
      }
    });

    socket.on('disconnect', async (reason) => {
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);
      // Ephemeral typing dies with the socket (remaining tabs keep their own state).
      typing.clearSocket(io, socket.id, userId);
      // Only the final disconnect flips to offline (multi-tab safe).
      const becameOffline = presence.removeSocket(userId, socket.id);
      if (!becameOffline) return;
      const lastSeen = new Date();
      try {
        const User = require('../models/User');
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
        const partners = await getPartnerIds(userId);
        partners.forEach((pid) =>
          io.to(`user:${pid}`).emit('user_offline', { userId, lastSeen: lastSeen.toISOString() })
        );
      } catch (err) {
        console.warn('[socket] offline broadcast failed:', err.message);
      }
    });
  });
}

module.exports = initSockets;
