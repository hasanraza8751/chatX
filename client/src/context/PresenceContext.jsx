import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useSocket } from './SocketContext.jsx';

// Live presence from user_online / user_offline events.
// Map: userId -> { online, lastSeen }. Empty = fall back to REST isOnline.
// Reconnects are handled by re-reading REST history + fresh events.
const PresenceContext = createContext(null);

export function PresenceProvider({ children }) {
  const { socket } = useSocket();
  const [live, setLive] = useState({});

  useEffect(() => {
    if (!socket) return;
    const onOnline = ({ userId }) => {
      if (!userId) return;
      setLive((prev) => ({ ...prev, [String(userId)]: { online: true, lastSeen: null } }));
    };
    const onOffline = ({ userId, lastSeen }) => {
      if (!userId) return;
      setLive((prev) => ({
        ...prev,
        [String(userId)]: { online: false, lastSeen: lastSeen || new Date().toISOString() },
      }));
    };
    socket.on('user_online', onOnline);
    socket.on('user_offline', onOffline);
    return () => {
      socket.off('user_online', onOnline);
      socket.off('user_offline', onOffline);
    };
  }, [socket]);

  const value = useMemo(() => ({ live }), [live]);
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) throw new Error('usePresence must be used inside <PresenceProvider>');
  return ctx;
}

// Resolve effective status: live socket event wins, otherwise REST fields.
export function resolvePresence(live, restUser) {
  const id = restUser && (restUser._id || restUser);
  const entry = id ? live[String(id)] : null;
  if (entry) return entry;
  return { online: !!(restUser && restUser.isOnline), lastSeen: restUser ? restUser.lastSeen : null };
}
