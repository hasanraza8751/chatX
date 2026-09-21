import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../context/ChatContext.jsx';
import { setNotificationOpener } from '../utils/notifications.js';

// Phase 10: transient in-app toasts for incoming messages received while NOT
// viewing that conversation. Click navigates; auto-dismiss after 6s.
// Also registers the global opener so browser-notification clicks route
// to the right conversation.
export default function Toasts() {
  const { toasts, dismissToast } = useChat();
  const navigate = useNavigate();

  useEffect(() => {
    setNotificationOpener((conversationId) => navigate(`/messages/${conversationId}`));
    return () => setNotificationOpener(null);
  }, [navigate]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => dismissToast(t.id), 6000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissToast]);

  if (toasts.length === 0) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className="toast"
          onClick={() => {
            // Same focus behavior as browser-notification clicks.
            try {
              if (window.focus) window.focus();
            } catch {
              /* ignore */
            }
            navigate(`/messages/${t.conversationId}`);
            dismissToast(t.id);
          }}
        >
          <strong className="toast-title">{t.senderName}</strong>
          <span className="toast-body">{t.preview}</span>
        </button>
      ))}
    </div>
  );
}
