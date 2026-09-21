import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useChat } from '../context/ChatContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import Avatar from './Avatar.jsx';
import { formatClock, formatLastSeen } from '../utils/formatTime.js';
import { usePresence, resolvePresence } from '../context/PresenceContext.jsx';

const PAGE_SIZE = 30;

// "<name> is typing..." for the open conversation (other participants only).
function TypingIndicator({ typingByConv, convId, participants }) {
  const flags = typingByConv[String(convId)] || {};
  const ids = Object.keys(flags);
  if (ids.length === 0) return null;
  const names = ids.map((tid) => {
    const p = (participants || []).find((x) => String(x._id || x) === String(tid));
    return p?.name || p?.username || 'Someone';
  });
  const text = names.length === 1 ? `${names[0]} is typing...` : `${names.length} people are typing...`;
  return (
    <p className="typing-indicator" aria-live="polite">
      {text}
      <span className="typing-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
    </p>
  );
}

// Active conversation pane: history via paginated REST, live appends via socket
// (dedupe by _id lives in ChatContext), auto-scroll that respects history browsing.
export default function ChatWindow() {
  const { id } = useParams();
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const { live } = usePresence();
  const { conversations, messagesByConv, loadHistory, sendMessage, sendImageMessage, setActiveId, typingByConv } = useChat();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const stickRef = useRef(true);
  const threadRef = useRef(null);
  // Phase 9A: image attachment. Plain file input (no camera/gallery permissions),
  // local preview + cancel, 10 MB / JPEG-PNG-WebP-GIF client pre-check
  // (server re-validates everything: MIME + magic bytes + size + membership).
  const fileRef = useRef(null);
  const [attached, setAttached] = useState(null); // File
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const clearAttachment = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAttached(null);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = '';
  };
  const onFileSelect = (e) => {
    const file = e.target.files && e.target.files[0];
    setError('');
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      setError('Unsupported image type. Allowed: JPEG, PNG, WebP, GIF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be 10 MB or smaller.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAttached(file);
    setPreviewUrl(URL.createObjectURL(file));
  };
  const onSendImage = async () => {
    if (!attached || sending || uploading) return;
    setError('');
    setUploading(true);
    stickRef.current = true;
    stopTyping();
    try {
      await sendImageMessage(id, attached);
      clearAttachment();
    } catch (err) {
      setError(err?.response?.data?.message || 'Image could not be sent.');
    } finally {
      setUploading(false);
    }
  };
  // Phase 8: composer typing detection. typing_start fires once per burst
  // (throttled by the flag); typing_stop fires after 1.5s idle, on send,
  // on clear, and on conversation close/unmount.
  const typingOnRef = useRef(false);
  const idleRef = useRef(null);
  const stopTyping = () => {
    if (idleRef.current) {
      clearTimeout(idleRef.current);
      idleRef.current = null;
    }
    if (typingOnRef.current) {
      typingOnRef.current = false;
      socket?.emit('typing_stop', { conversationId: String(id) });
    }
  };
  const onDraftChange = (e) => {
    const value = e.target.value;
    setDraft(value);
    if (!value.trim()) {
      stopTyping();
      return;
    }
    if (!typingOnRef.current) {
      typingOnRef.current = true;
      socket?.emit('typing_start', { conversationId: String(id) });
    }
    if (idleRef.current) clearTimeout(idleRef.current);
    idleRef.current = setTimeout(stopTyping, 1500);
  };
  // Conversation closed/switched: never leave a stale typing flag behind.
  useEffect(() => {
    return () => {
      if (idleRef.current) clearTimeout(idleRef.current);
      idleRef.current = null;
      typingOnRef.current = false;
      socket?.emit('typing_stop', { conversationId: String(id) });
    };
  }, [id, socket]);
  const conv = conversations.find((c) => String(c._id) === String(id));
  const other = (conv?.participants || []).find((p) => String(p._id || p) !== String(user?._id)) || {};
  const messages = messagesByConv[id] || [];
  const presence = resolvePresence(live, other);
  const presenceText = presence.online ? 'Online' : formatLastSeen(presence.lastSeen);

  useEffect(() => {
    setActiveId(id);
    setPage(1);
    setHasMore(false);
    setHistoryError('');
    setLoading(true);
    stickRef.current = true;
    loadHistory(id, 1, PAGE_SIZE)
      .then((data) => setHasMore(!!data.hasMore))
      .catch((err) => setHistoryError(err?.response?.data?.message || 'Could not load messages.'))
      .finally(() => setLoading(false));
    return () => setActiveId(null);
  }, [id, loadHistory, setActiveId]);

  // Switching conversation/unmount discards any unsent attachment preview.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  // Auto-scroll: stick to bottom only while the user is near the bottom.
  useEffect(() => {
    const el = threadRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, id]);

  useEffect(() => {
    if (messages.length > 0) setLoading(false);
  }, [messages.length]);

  const onScroll = () => {
    const el = threadRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickRef.current = nearBottom;
    setShowJump(!nearBottom);
  };

  const jumpToLatest = () => {
    const el = threadRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      stickRef.current = true;
      setShowJump(false);
    }
  };

  const loadMore = async () => {
    const el = threadRef.current;
    const prevHeight = el ? el.scrollHeight : 0;
    setLoadingMore(true);
    try {
      const data = await loadHistory(id, page + 1, PAGE_SIZE);
      setPage((p) => p + 1);
      setHasMore(!!data.hasMore);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } catch (err) {
      setHistoryError(err?.response?.data?.message || 'Could not load older messages.');
    } finally {
      setLoadingMore(false);
    }
  };

  const autoGrow = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const onSend = async (e) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setError('');
    setSending(true);
    stickRef.current = true;
    stopTyping(); // sent => no longer typing (server also clears on persist)
    try {
      await sendMessage(id, content);
      setDraft('');
      requestAnimationFrame(() => {
        const ta = document.querySelector('.composer textarea');
        if (ta) ta.style.height = 'auto';
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(e);
    }
  };

  return (
    <div className="chatpane">
      <header className="chat-head">
        <Link to="/messages" className="btn small back-btn" aria-label="Back to chats">←</Link>
        <Avatar name={other.name || '?'} size={36} />
        <div className="chat-identity">
          <strong>{other.name || 'Conversation'}</strong>
          <span className="hint">
            {other.username ? `@${other.username} · ` : ''}
            <span className={presence.online ? 'status-online' : 'status-offline'}>{presenceText}</span>
            {!connected && ' · reconnecting…'}
          </span>
        </div>
      </header>

      {historyError && (
        <p className="error chat-error" role="alert">
          {historyError}{' '}
          <button className="btn small" onClick={() => window.location.reload()}>Retry</button>
        </p>
      )}

      <div className="thread" ref={threadRef} onScroll={onScroll} aria-live="polite">
        {hasMore && !loading && (
          <button className="btn small load-more" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load older messages'}
          </button>
        )}
        {loading && messages.length === 0 ? (
          <div className="thread-skeleton" aria-label="Loading messages">
            {[0, 1, 2].map((i) => (
              <span key={i} className={i % 2 ? 'bubble theirs skeleton-box' : 'bubble mine skeleton-box'} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="hint thread-empty">No messages yet. Say hello.</p>
        ) : (
          messages.map((m) => {
            const mine = String(m.senderId) === String(user?._id);
            // Ticks: sent → ✓, delivered → ✓✓, read → ✓✓ highlighted (distinct read state).
            const tick = m.status === 'read' || m.status === 'delivered' ? '✓✓' : '✓';
            const tickTitle = m.status === 'read' ? 'Read' : m.status === 'delivered' ? 'Delivered' : 'Sent';
            const isImage = m.messageType === 'image' && m.image && m.image.url;
            return (
              <div key={m._id} className={mine ? 'bubble mine' : 'bubble theirs'}>
                {isImage ? (
                  <a href={m.image.url} target="_blank" rel="noreferrer">
                    <img
                      className="msg-image"
                      src={m.image.url}
                      alt={m.image.filename || 'Shared image'}
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <div className="bubble-text">{m.content}</div>
                )}
                <div className="meta">
                  {formatClock(m.createdAt)}
                  {mine && (
                    <span className={m.status === 'read' ? 'tick read' : 'tick'} title={tickTitle}>
                      {' '}{tick}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showJump && (
        <button className="jump-latest" onClick={jumpToLatest}>↓ New messages</button>
      )}
      {error && (
        <p className="error chat-error" role="alert">{error}</p>
      )}
      {sending && <p className="hint sending-hint">Sending…</p>}
      {uploading && <p className="hint sending-hint">Uploading image…</p>}
      {previewUrl && (
        <div className="preview-bar">
          <img className="preview-img" src={previewUrl} alt="Selected image preview" />
          <div className="preview-actions">
            <button className="btn small primary" onClick={onSendImage} disabled={uploading}>
              {uploading ? '…' : 'Send image'}
            </button>
            <button className="btn small" onClick={clearAttachment} disabled={uploading}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <TypingIndicator typingByConv={typingByConv} convId={id} participants={conv?.participants} />

      <form className="composer" onSubmit={onSend}>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onFileSelect}
          aria-label="Attach an image"
          hidden
        />
        <button
          type="button"
          className="btn attach-btn"
          onClick={() => fileRef.current && fileRef.current.click()}
          aria-label="Attach an image"
          title="Attach an image"
        >
          📎
        </button>
        <textarea
          value={draft}
          onChange={onDraftChange}
          onInput={autoGrow}
          onKeyDown={onKeyDown}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          aria-label="Type a message"
          maxLength={2000}
          rows={1}
        />
        <button className="btn primary" disabled={sending || !draft.trim()}>
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
