import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

// Phase 1 skeleton: creates ONE socket after login, disconnects on logout.
// Approved correction: withCredentials:true so the browser sends the
// httpOnly cookie automatically. NO auth.token, NO localStorage JWT.
// Production builds REQUIRE VITE_SOCKET_URL (no silent localhost fallback);
// development keeps the localhost default for the local workflow.
const SocketContext = createContext(null);

function getSocketUrl() {
  const url = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:5000' : undefined);
  if (!url) {
    throw new Error('Missing VITE_SOCKET_URL environment variable. Set it in client/.env (see .env.example).');
  }
  return url;
}

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      setSocket(null);
      setConnected(false);
      return;
    }
    const s = io(getSocketUrl(), {
      withCredentials: true,
    });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => setConnected(false));
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used inside <SocketProvider>');
  return ctx;
}
