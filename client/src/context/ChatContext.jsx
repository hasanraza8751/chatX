import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { listConversations } from '../api/conversations.js';
import { listMessages, sendMessage as sendMessageApi, sendImage as sendImageApi, sendVideo as sendVideoApi, sendVoice as sendVoiceApi } from '../api/messages.js';
import { useSocket } from './SocketContext.jsx';
import { useAuth } from './AuthContext.jsx';

// Holds conversation list + per-conversation messages.
// History always comes from REST (source of truth); Socket only appends
// the SAME persisted docs, deduped by _id (REST response vs socket event).
// Phase 7B: the receiver explicitly acks delivery (message_delivered) when a
// message actually arrives; the sender's ticks update on the status event.
// Phase 7C: read acks (message_read) fire ONLY for the open + visible
// conversation — never on background history fetches.
const ChatContext = createContext(null);

function upsertMessage(list, msg) {
  if (list.some((m) => String(m._id) === String(msg._id))) return list;
  return [...list, msg].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export function ChatProvider({ children }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const myId = user?._id ? String(user._id) : null;
  const [conversations, setConversations] = useState([]);
  const [messagesByConv, setMessagesByConv] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  // Phase 8: ephemeral typing flags per conversation (never persisted).
  const [typingByConv, setTypingByConv] = useState({});
  const typingTimers = useRef({});
  // Mirrors for use inside socket callbacks (avoid stale closures).
  const activeRef = useRef(null);
  const messagesRef = useRef({});
  useEffect(() => {
    activeRef.current = activeId ? String(activeId) : null;
  }, [activeId]);
  useEffect(() => {
    messagesRef.current = messagesByConv;
  }, [messagesByConv]);

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await listConversations();
      setConversations(data.conversations || []);
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Phase 7C gate: read-ack ONLY the open + visible conversation.
  // Background history fetches (other conversations, preloads) never mark read.
  const ackRead = useCallback((conversationId, msgs) => {
    if (!socket || !myId) return;
    if (activeRef.current !== String(conversationId)) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    (msgs || []).forEach((m) => {
      if (String(m.receiverId) === myId && (m.status === 'sent' || m.status === 'delivered')) {
        socket.emit('message_read', { messageId: String(m._id), conversationId: String(m.conversationId) });
      }
    });
  }, [socket, myId]);

  const loadHistory = useCallback(async (conversationId, page = 1, limit = 30) => {
    const data = await listMessages(conversationId, page, limit);
    setMessagesByConv((prev) => {
      if (page === 1) return { ...prev, [conversationId]: data.messages || [] };
      const merged = [...(data.messages || []), ...(prev[conversationId] || [])];
      const seen = new Set();
      return {
        ...prev,
        [conversationId]: merged.filter((m) => {
          const k = String(m._id);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        }),
      };
    });
    // Phase 7B: history fetch alone never marks delivery server-side.
    // The client explicitly acks messages it actually displays (reconnect recovery path).
    if (socket && myId) {
      (data.messages || []).forEach((m) => {
        if (String(m.receiverId) === myId && m.status === 'sent') {
          socket.emit('message_delivered', { messageId: String(m._id), conversationId: String(m.conversationId) });
        }
      });
    }
    // Phase 7C: read-ack displayed messages only if this conversation is open + visible.
    ackRead(conversationId, data.messages);
    return data;
  }, [socket, myId, ackRead]);

  // Phase 9A: image send. Same dedupe/sidebar treatment as text;
  // the socket echo of the persisted doc merges by _id.
  const sendImageMessage = useCallback(async (conversationId, file) => {
    const data = await sendImageApi(conversationId, file);
    const msg = data.message;
    setMessagesByConv((prev) => ({
      ...prev,
      [conversationId]: upsertMessage(prev[conversationId] || [], msg),
    }));
    setConversations((prev) =>
      prev
        .map((c) => (String(c._id) === String(conversationId) ? { ...c, lastMessage: msg, lastMessageAt: msg.createdAt } : c))
        .sort((a, b) => new Date(b.lastMessageAt || b.updatedAt) - new Date(a.lastMessageAt || a.updatedAt))
    );
    return msg;
  }, []);

  // Phase 9B: video send. Same dedupe/sidebar treatment as text/image;
  // the socket echo of the persisted doc merges by _id.
  const sendVideoMessage = useCallback(async (conversationId, file, onProgress) => {
    const data = await sendVideoApi(conversationId, file, onProgress);
    const msg = data.message;
    setMessagesByConv((prev) => ({
      ...prev,
      [conversationId]: upsertMessage(prev[conversationId] || [], msg),
    }));
    setConversations((prev) =>
      prev
        .map((c) => (String(c._id) === String(conversationId) ? { ...c, lastMessage: msg, lastMessageAt: msg.createdAt } : c))
        .sort((a, b) => new Date(b.lastMessageAt || b.updatedAt) - new Date(a.lastMessageAt || a.updatedAt))
    );
    return msg;
  }, []);

  // Phase 9C: voice send. Same dedupe/sidebar treatment;
  // the socket echo of the persisted doc merges by _id.
  const sendVoiceMessage = useCallback(async (conversationId, preview) => {
    const base = String(preview.mimeType || '').split(';')[0].trim().toLowerCase();
    const ext = base.includes('mp4') ? 'mp4' : base.includes('ogg') ? 'ogg' : 'webm';
    const data = await sendVoiceApi(conversationId, {
      blob: preview.blob,
      filename: `voice-message.${ext}`,
      mimeType: preview.mimeType,
      durationMs: preview.durationMs,
    });
    const msg = data.message;
    setMessagesByConv((prev) => ({
      ...prev,
      [conversationId]: upsertMessage(prev[conversationId] || [], msg),
    }));
    setConversations((prev) =>
      prev
        .map((c) => (String(c._id) === String(conversationId) ? { ...c, lastMessage: msg, lastMessageAt: msg.createdAt } : c))
        .sort((a, b) => new Date(b.lastMessageAt || b.updatedAt) - new Date(a.lastMessageAt || a.updatedAt))
    );
    return msg;
  }, []);

  const sendMessage = useCallback(async (conversationId, content) => {
    const data = await sendMessageApi(conversationId, content);
    const msg = data.message;
    setMessagesByConv((prev) => ({
      ...prev,
      [conversationId]: upsertMessage(prev[conversationId] || [], msg),
    }));
    setConversations((prev) =>
      prev
        .map((c) => (String(c._id) === String(conversationId) ? { ...c, lastMessage: msg, lastMessageAt: msg.createdAt } : c))
        .sort((a, b) => new Date(b.lastMessageAt || b.updatedAt) - new Date(a.lastMessageAt || a.updatedAt))
    );
    return msg;
  }, []);

  // Socket listener: append persisted docs, dedupe by _id; bump sidebar on updates.
  // Phase 7B: ack delivery when I am the receiver; flip ticks on status events.
  // Phase 7C: ack read only when the conversation is open + visible here.
  useEffect(() => {
    if (!socket) return;
    const onReceive = ({ message }) => {
      if (!message || !message._id || !message.conversationId) return;
      const cid = String(message.conversationId);
      if (myId && String(message.receiverId) === myId && message.status === 'sent') {
        socket.emit('message_delivered', { messageId: String(message._id), conversationId: cid });
      }
      if (myId && String(message.receiverId) === myId) {
        ackRead(cid, [message]);
      }
      setMessagesByConv((prev) => {
        if (!prev[cid]) return prev; // history not loaded yet → REST will fetch on open
        return { ...prev, [cid]: upsertMessage(prev[cid], message) };
      });
      setConversations((prev) =>
        prev
          .map((c) => (String(c._id) === cid ? { ...c, lastMessage: message, lastMessageAt: message.createdAt } : c))
          .sort((a, b) => new Date(b.lastMessageAt || b.updatedAt) - new Date(a.lastMessageAt || a.updatedAt))
      );
    };
    const onUpdated = ({ conversationId, lastMessage }) => {
      if (!conversationId) return;
      setConversations((prev) => {
        if (!prev.some((c) => String(c._id) === String(conversationId))) {
          loadConversations(); // new conversation arrived → refresh list via REST
          return prev;
        }
        return prev
          .map((c) => (String(c._id) === String(conversationId) ? { ...c, lastMessage, lastMessageAt: lastMessage?.createdAt } : c))
          .sort((a, b) => new Date(b.lastMessageAt || b.updatedAt) - new Date(a.lastMessageAt || a.updatedAt));
      });
    };
    socket.on('receive_message', onReceive);
    socket.on('conversation_updated', onUpdated);
    // Phase 8: typing indicator with client-side safety timeout (clears stale
    // flags even if a stop event is lost). Own echoes are ignored.
    const clearTypingFlag = (cid, tid) => {
      setTypingByConv((prev) => {
        if (!prev[cid] || !prev[cid][tid]) return prev;
        const next = { ...prev[cid] };
        delete next[tid];
        return { ...prev, [cid]: next };
      });
    };
    const onTyping = ({ conversationId, userId: typerId, typing }) => {
      if (!conversationId || !typerId) return;
      if (myId && String(typerId) === myId) return;
      const cid = String(conversationId);
      const tid = String(typerId);
      const timerKey = `${cid}:${tid}`;
      if (typingTimers.current[timerKey]) {
        clearTimeout(typingTimers.current[timerKey]);
        delete typingTimers.current[timerKey];
      }
      if (!typing) {
        clearTypingFlag(cid, tid);
        return;
      }
      setTypingByConv((prev) => ({ ...prev, [cid]: { ...(prev[cid] || {}), [tid]: Date.now() } }));
      typingTimers.current[timerKey] = setTimeout(() => {
        delete typingTimers.current[timerKey];
        clearTypingFlag(cid, tid);
      }, 6000);
    };
    socket.on('typing_update', onTyping);
    const applyStatus = (messageId, conversationId, status) => {
      const cid = String(conversationId);
      setMessagesByConv((prev) => {
        if (!prev[cid]) return prev;
        return {
          ...prev,
          [cid]: prev[cid].map((m) =>
            String(m._id) === String(messageId) ? { ...m, status } : m
          ),
        };
      });
      setConversations((prev) =>
        prev.map((c) => {
          if (String(c._id) !== cid) return c;
          if (!c.lastMessage || String(c.lastMessage._id) !== String(messageId)) return c;
          return { ...c, lastMessage: { ...c.lastMessage, status } };
        })
      );
    };
    const onDelivered = ({ messageId, conversationId, status }) => {
      if (!messageId || status !== 'delivered') return;
      applyStatus(messageId, conversationId, 'delivered');
    };
    const onRead = ({ messageId, conversationId, status }) => {
      if (!messageId || status !== 'read') return;
      applyStatus(messageId, conversationId, 'read');
    };
    socket.on('message_delivered', onDelivered);
    socket.on('message_read', onRead);
    return () => {
      socket.off('receive_message', onReceive);
      socket.off('conversation_updated', onUpdated);
      socket.off('message_delivered', onDelivered);
      socket.off('message_read', onRead);
      socket.off('typing_update', onTyping);
    };
  }, [socket, myId, ackRead, loadConversations]);

  // Phase 7C: returning to a visible tab re-acks the open conversation's
  // displayed messages (covers messages that arrived while hidden).
  useEffect(() => {
    if (!socket) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const cid = activeRef.current;
      if (!cid) return;
      ackRead(cid, messagesRef.current[cid] || []);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [socket, ackRead]);

  const value = useMemo(
    () => ({ conversations, messagesByConv, activeId, setActiveId, loadingList, loadConversations, loadHistory, sendMessage, sendImageMessage, sendVideoMessage, sendVoiceMessage, typingByConv }),
    [conversations, messagesByConv, activeId, loadingList, loadConversations, loadHistory, sendMessage, typingByConv]
  );
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>');
  return ctx;
}
