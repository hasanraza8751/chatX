import { useEffect } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { useChat } from '../context/ChatContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { usePresence } from '../context/PresenceContext.jsx';
import ConversationList from '../components/ConversationList.jsx';
import NewChatSearch from '../components/NewChatSearch.jsx';
import Toasts from '../components/Toasts.jsx';
import Avatar from '../components/Avatar.jsx';

// Desktop: sidebar + conversation side by side.
// Mobile (narrow): list view for /messages, chat view for /messages/:id (back button returns).
// Presentation only — conversation/socket logic is unchanged.
export default function MessengerLayout() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const { conversations, loadingList, loadConversations, unreadByConv } = useChat();
  const { live } = usePresence();
  const { id } = useParams();
  const location = useLocation();
  const inDetail = /^\/messages\/.+/.test(location.pathname);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return (
    <div className={inDetail ? 'messenger show-chat' : 'messenger'}>
      <aside className="m-side" aria-label="Conversations">
        <div className="m-side-head">
          <div className="m-brand">
            <span className="logo small">CX</span>
            <strong>ChatX</strong>
          </div>
          <Link className="me-link" to="/profile" aria-label="My profile">
            <Avatar name={user?.name} size={28} />
            <span>{user?.name ? user.name.split(' ')[0] : 'Profile'}</span>
          </Link>
        </div>
        <NewChatSearch />
        <div className="m-list-wrap">
          <ConversationList
            conversations={conversations}
            activeId={id}
            myId={user?._id}
            loading={loadingList}
            error=""
            onRetry={loadConversations}
            livePresence={live}
            unreadByConv={unreadByConv}
          />
        </div>
        <div className="m-side-foot">
          <span className="conn" role="status" title={connected ? 'Connected' : 'Connecting'}>
            {connected ? (
              <><span className="status-dot on" />Connected</>
            ) : (
              <><span className="status-dot mid" />Connecting…</>
            )}
          </span>
          <span className="foot-links">
            <Link to="/dashboard">Home</Link>
            <button className="linklike" onClick={logout}>Logout</button>
          </span>
        </div>
      </aside>
      <section className="m-main">
        <Outlet />
      </section>
      <Toasts />
    </div>
  );
}
