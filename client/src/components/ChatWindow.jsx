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
  const { conversations, messagesByConv, loadHistory, sendMessage, sendImageMessage, sendVideoMessage, sendVoiceMessage, setActiveId, typingByConv } = useChat();
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
  // Phase 9A/9B: attachments. Plain file inputs (no camera/gallery permissions),
  // local preview + cancel. Client pre-checks type/size; the server re-validates
  // everything (MIME + magic bytes + size + membership). Upload starts only on Send.
  const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime'];
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const [attached, setAttached] = useState(null); // { file, kind: 'image' | 'video' }
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // 0-100 while sending video
  const clearAttachment = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAttached(null);
    setPreviewUrl(null);
    setUploadProgress(null);
    if (fileRef.current) fileRef.current.value = '';
    if (videoRef.current) videoRef.current.value = '';
  };
  const pickFile = (file, kind) => {
    setError('');
    if (!file) return;
    const allowed = kind === 'video' ? VIDEO_MIME : IMAGE_MIME;
    const maxBytes = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    const label = kind === 'video' ? 'MP4, WebM, QuickTime' : 'JPEG, PNG, WebP, GIF';
    const maxLabel = kind === 'video' ? '50 MB' : '10 MB';
    if (!allowed.includes(file.type)) {
      setError(`Unsupported ${kind} type. Allowed: ${label}.`);
      return;
    }
    if (file.size > maxBytes) {
      setError(`${kind === 'video' ? 'Video' : 'Image'} must be ${maxLabel} or smaller.`);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAttached({ file, kind });
    setPreviewUrl(URL.createObjectURL(file));
    setUploadProgress(null);
  };
  const onFileSelect = (e) => {
    pickFile(e.target.files && e.target.files[0], 'image');
  };
  const onVideoSelect = (e) => {
    pickFile(e.target.files && e.target.files[0], 'video');
  };
  const onSendImage = async () => {
    if (!attached || attached.kind !== 'image' || sending || uploading) return;
    setError('');
    setUploading(true);
    stickRef.current = true;
    stopTyping();
    try {
      await sendImageMessage(id, attached.file);
      clearAttachment();
    } catch (err) {
      setError(err?.response?.data?.message || 'Image could not be sent.');
    } finally {
      setUploading(false);
    }
  };
  const onSendVideo = async () => {
    if (!attached || attached.kind !== 'video' || sending || uploading) return;
    setError('');
    setUploading(true);
    setUploadProgress(0);
    stickRef.current = true;
    stopTyping();
    try {
      // No duplicate sends while this upload is in flight (guard above + disabled UI).
      await sendVideoMessage(id, attached.file, (pct) => setUploadProgress(pct));
      clearAttachment();
    } catch (err) {
      setError(err?.response?.data?.message || 'Video could not be sent.');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };
  // Phase 9C: voice recording. MediaRecorder is created ONLY after the user
  // presses Record (mic permission is never requested on load). Recording stops
  // via Stop / Cancel / 2-minute cap / send / conversation switch / unmount —
  // every path stops all MediaStream tracks and revokes Blob URLs.
  const MAX_VOICE_MS = 2 * 60 * 1000;
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const discardRef = useRef(false);
  const startTimeRef = useRef(0);
  const elapsedTimerRef = useRef(null);
  const capTimerRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const [voicePreview, setVoicePreview] = useState(null); // { blobUrl, blob, mimeType, durationMs }
  const recorderSupported = () =>
    typeof window !== 'undefined' &&
    !!window.MediaRecorder &&
    !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const pickRecorderMime = () => {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    for (const t of candidates) {
      try {
        if (window.MediaRecorder.isTypeSupported(t)) return t;
      } catch {
        /* try next */
      }
    }
    return ''; // constructor default; actual type read back from recorder.mimeType
  };
  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* already stopped */
        }
      });
      streamRef.current = null;
    }
  };
  const clearRecTimers = () => {
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    if (capTimerRef.current) clearTimeout(capTimerRef.current);
    elapsedTimerRef.current = null;
    capTimerRef.current = null;
  };
  const startRecording = async () => {
    setError('');
    if (recording || sending || uploading || voicePreview) return;
    if (!recorderSupported()) {
      setError("Voice recording isn't supported in this browser.");
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        setError('Microphone permission was denied. Allow access to record a voice message.');
      } else if (err && err.name === 'NotFoundError') {
        setError('No microphone was found on this device.');
      } else {
        setError('Could not start recording. Please try again.');
      }
      return;
    }
    const mimeType = pickRecorderMime();
    let recorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (err) {
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      setError("Voice recording isn't supported in this browser.");
      return;
    }
    chunksRef.current = [];
    discardRef.current = false;
    streamRef.current = stream;
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onerror = () => {
      setError('Recording failed. Please try again.');
    };
    recorder.onstop = () => {
      clearRecTimers();
      stopTracks();
      recorderRef.current = null;
      setRecording(false);
      if (discardRef.current) {
        discardRef.current = false;
        return; // cancelled: chunks dropped, no preview
      }
      const chunks = chunksRef.current;
      chunksRef.current = [];
      const total = chunks.reduce((n, c) => n + c.size, 0);
      if (chunks.length === 0 || total === 0) {
        setError('Empty recording. Hold the microphone closer and try again.');
        return;
      }
      const actualType = recorder.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type: actualType });
      const durationMs = Date.now() - startTimeRef.current;
      setVoicePreview({ blobUrl: URL.createObjectURL(blob), blob, mimeType: actualType, durationMs });
    };
    startTimeRef.current = Date.now();
    setRecElapsed(0);
    recorder.start();
    setRecording(true);
    elapsedTimerRef.current = setInterval(() => {
      setRecElapsed(Date.now() - startTimeRef.current);
    }, 250);
    // 2-minute cap: auto-stop but PRESERVE the recording (same onstop path).
    capTimerRef.current = setTimeout(() => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    }, MAX_VOICE_MS);
  };
  const stopRecording = (discard) => {
    discardRef.current = !!discard;
    clearRecTimers();
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop(); // onstop builds the preview (or drops it when discarding)
      } catch {
        stopTracks();
        recorderRef.current = null;
        setRecording(false);
      }
    } else {
      stopTracks();
      recorderRef.current = null;
      setRecording(false);
      if (discard) {
        if (voicePreview) URL.revokeObjectURL(voicePreview.blobUrl);
        setVoicePreview(null);
      }
    }
  };
  const cancelVoice = () => {
    if (voicePreview) URL.revokeObjectURL(voicePreview.blobUrl);
    setVoicePreview(null);
    stopRecording(true);
  };
  const onSendVoice = async () => {
    if (!voicePreview || sending || uploading) return;
    setError('');
    setUploading(true);
    stickRef.current = true;
    stopTyping();
    try {
      await sendVoiceMessage(id, voicePreview);
      if (voicePreview) URL.revokeObjectURL(voicePreview.blobUrl);
      setVoicePreview(null);
    } catch (err) {
      // Keep the preview so the user can retry.
      setError(err?.response?.data?.message || 'Voice message could not be sent.');
    } finally {
      setUploading(false);
    }
  };
  const formatElapsed = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
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

  // Switching conversation/unmount discards any unsent attachment preview,
  // stops an active recording, and releases mic tracks + Blob URLs.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      discardRef.current = true;
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      if (capTimerRef.current) clearTimeout(capTimerRef.current);
      elapsedTimerRef.current = null;
      capTimerRef.current = null;
      try {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      } catch {
        /* ignore */
      }
      recorderRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {
            /* ignore */
          }
        });
        streamRef.current = null;
      }
      setRecording(false);
      setVoicePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev.blobUrl);
        return null;
      });
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
            const isVideo = m.messageType === 'video' && m.video && m.video.url;
            const isVoice = m.messageType === 'voice' && m.voice && m.voice.url;
            return (
              <div key={m._id} className={mine ? 'bubble mine' : 'bubble theirs'}>
                {isVoice ? (
                  <div className="voice-msg">
                    <audio className="msg-audio" src={m.voice.url} controls preload="metadata" />
                    <span className="hint voice-dur">
                      {typeof m.voice.duration === 'number' ? formatElapsed(m.voice.duration * 1000) : ''}
                    </span>
                  </div>
                ) : isVideo ? (
                  <video
                    className="msg-video"
                    src={m.video.url}
                    poster={m.video.thumbnail || undefined}
                    controls
                    preload="metadata"
                    playsInline
                  />
                ) : isImage ? (
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
      {uploading && !voicePreview && (
        <p className="hint sending-hint" aria-live="polite">
          {attached && attached.kind === 'video'
            ? `Uploading video…${uploadProgress !== null ? ` ${uploadProgress}%` : ''}`
            : 'Uploading image…'}
        </p>
      )}
      {uploading && voicePreview && (
        <p className="hint sending-hint" aria-live="polite">Uploading voice message…</p>
      )}
      {uploadProgress !== null && attached && attached.kind === 'video' && (
        <div className="progress-track" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin="0" aria-valuemax="100" aria-label="Video upload progress">
          <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}
      {previewUrl && attached && (
        <div className="preview-bar">
          {attached.kind === 'video' ? (
            <video className="preview-video" src={previewUrl} controls preload="metadata" playsInline />
          ) : (
            <img className="preview-img" src={previewUrl} alt="Selected image preview" />
          )}
          <div className="preview-actions">
            <span className="hint preview-meta">
              {attached.file.name} · {(attached.file.size / 1048576).toFixed(1)} MB
            </span>
            {attached.kind === 'video' ? (
              <button className="btn small primary" onClick={onSendVideo} disabled={uploading}>
                {uploading ? '…' : 'Send video'}
              </button>
            ) : (
              <button className="btn small primary" onClick={onSendImage} disabled={uploading}>
                {uploading ? '…' : 'Send image'}
              </button>
            )}
            <button className="btn small" onClick={clearAttachment} disabled={uploading}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {recording && (
        <div className="rec-bar" role="status" aria-live="polite">
          <span className="rec-dot" aria-hidden="true" />
          <span>🎙️ Recording {formatElapsed(recElapsed)}</span>
          <button className="btn small primary" onClick={() => stopRecording(false)} disabled={uploading}>
            Stop
          </button>
          <button className="btn small" onClick={() => stopRecording(true)} disabled={uploading}>
            Cancel
          </button>
        </div>
      )}
      {voicePreview && !recording && (
        <div className="preview-bar">
          <audio className="preview-audio" src={voicePreview.blobUrl} controls preload="metadata" />
          <div className="preview-actions">
            <span className="hint preview-meta">🎙️ {formatElapsed(voicePreview.durationMs)}</span>
            <button className="btn small primary" onClick={onSendVoice} disabled={uploading}>
              {uploading ? '…' : 'Send voice'}
            </button>
            <button className="btn small" onClick={cancelVoice} disabled={uploading}>
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
        <input
          ref={videoRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={onVideoSelect}
          aria-label="Attach a video"
          hidden
        />
        <button
          type="button"
          className="btn attach-btn"
          onClick={() => fileRef.current && fileRef.current.click()}
          aria-label="Attach an image"
          title="Attach an image"
          disabled={recording || uploading || !!voicePreview}
        >
          📎
        </button>
        <button
          type="button"
          className="btn attach-btn"
          onClick={() => videoRef.current && videoRef.current.click()}
          aria-label="Attach a video"
          title="Attach a video"
          disabled={recording || uploading || !!voicePreview}
        >
          🎬
        </button>
        <button
          type="button"
          className="btn attach-btn"
          onClick={startRecording}
          aria-label="Record a voice message"
          title="Record a voice message"
          disabled={recording || uploading || !!voicePreview || !!attached}
        >
          🎙️
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
          disabled={recording}
        />
        <button className="btn primary" disabled={sending || recording || !draft.trim()}>
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
