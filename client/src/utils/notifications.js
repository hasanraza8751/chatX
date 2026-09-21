// Phase 10: notification content + browser Notification helpers.
// Previews never include ids, JWTs, or the quoted parent of a reply —
export function previewFor(message) {
  if (!message) return 'New message';
  switch (message.messageType) {
    case 'image':
      return '🖼️ Image';
    case 'video':
      return '🎥 Video';
    case 'voice':
      return '🎙️ Voice message';
    default:
      return String(message.content || 'New message').slice(0, 80);
  }
}

export function notificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

// Global opener registered by a routed component (Toasts). Lets
// browser-notification clicks navigate without putting router
// dependencies inside state contexts.
let opener = null;
export function setNotificationOpener(fn) {
  opener = typeof fn === 'function' ? fn : null;
}

// Request permission ONLY from an explicit user gesture (called on first
// send), never on page load. Resolves true when notifications may show.
export async function ensureNotificationPermission() {
  if (!notificationSupported()) return false;
  try {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

// Shows a browser notification for an incoming message. No-ops when
// unsupported, unpermitted, or data is missing. Returns the Notification.
export function showBrowserNotification({ title, body, conversationId, onOpen }) {
  if (!notificationSupported()) return null;
  try {
    if (Notification.permission !== 'granted') return null;
    const n = new Notification(title, { body, tag: `chatx-${conversationId}` });
    n.onclick = () => {
      try {
        if (window.focus) window.focus();
      } catch {
        /* ignore */
      }
      try {
        if (onOpen) onOpen(conversationId);
        else if (opener) opener(conversationId);
      } catch {
        /* ignore */
      }
      try {
        n.close();
      } catch {
        /* ignore */
      }
    };
    return n;
  } catch {
    return null;
  }
}
