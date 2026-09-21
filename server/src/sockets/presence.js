// Phase 7A: in-memory socket tracking per authenticated user.
// Online = at least one active socket. All map mutations are synchronous,
// so rapid connect/disconnect bursts stay consistent (Node runs each
// connection/disconnect handler without interleaving the bookkeeping).
// Single-instance scope is enough for the MVP.
const socketsByUser = new Map(); // userId -> Set<socketId>

// Returns true only on the 0 -> 1 transition (user just became online).
function addSocket(userId, socketId) {
  const id = String(userId);
  let set = socketsByUser.get(id);
  if (!set) {
    set = new Set();
    socketsByUser.set(id, set);
  }
  const becameOnline = set.size === 0;
  set.add(String(socketId));
  return becameOnline;
}

// Returns true only on the 1 -> 0 transition (last socket gone -> offline).
function removeSocket(userId, socketId) {
  const id = String(userId);
  const set = socketsByUser.get(id);
  if (!set) return false;
  set.delete(String(socketId));
  if (set.size === 0) {
    socketsByUser.delete(id);
    return true;
  }
  return false;
}

function isOnline(userId) {
  const set = socketsByUser.get(String(userId));
  return !!set && set.size > 0;
}

module.exports = { addSocket, removeSocket, isOnline };
