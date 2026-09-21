// Phase 8: ephemeral typing state. NOTHING here touches MongoDB.
// Keyed by conversation+user with a per-socket set, so multiple tabs of the
// same user behave sensibly: typing clears only when the last typing socket
// stops, disconnects, or goes quiet past the timeout.
const TYPING_TIMEOUT_MS = 5000;

const states = new Map(); // `${convId}:${userId}` -> { sockets:Set, others:[ids], timer }

function keyOf(convId, userId) {
  return `${String(convId)}:${String(userId)}`;
}

function emitOthers(io, convId, userId, others, typing) {
  (others || []).forEach((pid) => {
    io.to(`user:${String(pid)}`).emit('typing_update', {
      conversationId: String(convId),
      userId: String(userId),
      typing: !!typing,
    });
  });
}

function armTimer(io, convId, userId, entry) {
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    states.delete(keyOf(convId, userId));
    emitOthers(io, convId, userId, entry.others, false);
  }, TYPING_TIMEOUT_MS);
  // Don't keep the process alive for typing timers alone.
  if (entry.timer.unref) entry.timer.unref();
}

// Returns true if this (re)started a visible typing state.
function start(io, convId, userId, socketId, otherIds) {
  const k = keyOf(convId, userId);
  let entry = states.get(k);
  if (!entry) {
    entry = { sockets: new Set(), others: (otherIds || []).map(String), timer: null };
    states.set(k, entry);
  }
  const wasEmpty = entry.sockets.size === 0;
  entry.sockets.add(String(socketId));
  entry.others = (otherIds || []).map(String);
  armTimer(io, convId, userId, entry);
  if (wasEmpty) emitOthers(io, convId, userId, entry.others, true);
  return wasEmpty;
}

function stop(io, convId, userId, socketId) {
  const k = keyOf(convId, userId);
  const entry = states.get(k);
  if (!entry) return false;
  entry.sockets.delete(String(socketId));
  if (entry.sockets.size > 0) {
    armTimer(io, convId, userId, entry);
    return false;
  }
  if (entry.timer) clearTimeout(entry.timer);
  states.delete(k);
  emitOthers(io, convId, userId, entry.others, false);
  return true;
}

// Sender just sent (or cleared the composer): no longer typing, all sockets.
function clearUserConv(io, convId, userId) {
  const k = keyOf(convId, userId);
  const entry = states.get(k);
  if (!entry) return false;
  if (entry.timer) clearTimeout(entry.timer);
  states.delete(k);
  emitOthers(io, convId, userId, entry.others, false);
  return true;
}

// Socket gone: drop it from every typing set; clear entries left with no sockets.
function clearSocket(io, socketId, userId) {
  const sid = String(socketId);
  for (const [k, entry] of states) {
    if (!entry.sockets.has(sid)) continue;
    entry.sockets.delete(sid);
    if (entry.sockets.size === 0) {
      if (entry.timer) clearTimeout(entry.timer);
      states.delete(k);
      const sep = k.lastIndexOf(':');
      emitOthers(io, k.slice(0, sep), userId, entry.others, false);
    }
  }
}

module.exports = { start, stop, clearUserConv, clearSocket, TYPING_TIMEOUT_MS };
