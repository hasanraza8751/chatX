import { NavLink } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import { formatPreview } from '../utils/formatTime.js';
import { resolvePresence } from '../context/PresenceContext.jsx';

export function otherParticipant(conv, myId) {
  return (conv.participants || []).find((p) => String(p._id || p) !== String(myId)) || {};
}

function SkeletonRow() {
  return (
    <li className="conv skeleton" aria-hidden="true">
      <span className="avatar skeleton-box" />
      <span className="conv-body">
        <span className="skeleton-line w60" />
        <span className="skeleton-line w90" />
      </span>
    </li>
  );
}

export default function ConversationList({ conversations, activeId, myId, loading, error, onRetry, livePresence, unreadByConv }) {
  if (loading && conversations.length === 0) {
    return (
      <ul className="conv-list" aria-label="Loading conversations">
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </ul>
    );
  }
  if (error && conversations.length === 0) {
    return (
      <div className="side-state" role="alert">
        <p>Couldn’t load chats. {error}</p>
        <button className="btn" onClick={onRetry}>Retry</button>
      </div>
    );
  }
  if (conversations.length === 0) {
    return (
      <div className="side-state">
        <p>No conversations yet.</p>
        <p className="hint">Search above to start your first chat.</p>
      </div>
    );
  }
  return (
    <ul className="conv-list">
      {conversations.map((c) => {
        const other = otherParticipant(c, myId);
        const isActive = String(c._id) === String(activeId);
        const status = resolvePresence(livePresence || {}, other);
        const unread = (unreadByConv && unreadByConv[String(c._id)]) || 0;
        return (
          <li key={c._id}>
            <NavLink
              to={`/messages/${c._id}`}
              className={isActive ? 'conv active' : 'conv'}
              aria-current={isActive ? 'true' : undefined}
            >
              <span className="avatar-wrap">
                <Avatar name={other.name} />
                <span
                  className={status.online ? 'presence-dot online' : 'presence-dot'}
                  title={status.online ? 'Online' : 'Offline'}
                />
              </span>
              <span className="conv-body">
                <span className="conv-top">
                  <strong className="conv-name">{other.name || 'Unknown'}</strong>
                  <span className="conv-time">{c.lastMessage ? formatPreview(c.lastMessage.createdAt) : ''}</span>
                </span>
                <span className="conv-preview">
                  {!c.lastMessage
                    ? 'No messages yet'
                    : c.lastMessage.messageType === 'image'
                      ? '📷 Photo'
                      : c.lastMessage.messageType === 'video'
                        ? '🎬 Video'
                        : c.lastMessage.messageType === 'voice'
                          ? '🎙️ Voice message'
                          : (c.lastMessage.content || '').slice(0, 48)}
                </span>
              </span>
              {unread > 0 && (
                <span className="unread-badge" aria-label={`${unread} unread messages`}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}
