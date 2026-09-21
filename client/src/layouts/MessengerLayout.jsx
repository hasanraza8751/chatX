import { useEffect } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { useChat } from '../context/ChatContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePresence } from '../context/PresenceContext.jsx';
import ConversationList from '../components/ConversationList.jsx';
import NewChatSearch from '../components/NewChatSearch.jsx';

// Desktop: sidebar + conversation side by side.
// Mobile (narrow): list view for /messages, chat view for /messages/:id (back button returns).
export default function MessengerLayout() {
  const { user, logout } = useAuth();
  const { conversations, loadingList, loadConversations } = useChat();
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
          <Link className="btn small" to="/profile" aria-label="My profile">
            {user?.name ? user.name.split(' ')[0] : 'Profile'}
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
          />
        </div>
        <div className="m-side-foot">
          <Link className="hint" to="/dashboard">Dashboard</Link>
          <button className="linklike" onClick={logout}>Logout</button>
        </div>
      </aside>
      <section className="m-main">
        <Outlet />
      </section>
    </div>
  );
}
