import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useChat } from '../context/ChatContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function otherParticipant(conv, myId) {
  return (conv.participants || []).find((p) => String(p._id || p) !== String(myId)) || {};
}

export default function Conversations() {
  const { user } = useAuth();
  const { conversations, loadingList, loadConversations } = useChat();

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return (
    <main className="page">
      <h1>Chats</h1>
      <section className="card">
        {loadingList && <p>Loading…</p>}
        {!loadingList && conversations.length === 0 && (
          <p className="hint">No conversations yet. <Link to="/search">Find people</Link> to start one.</p>
        )}
        <ul className="results">
          {conversations.map((c) => {
            const other = otherParticipant(c, user?._id);
            return (
              <li key={c._id} className="result">
                <div>
                  <strong>{other.name || 'Unknown'}</strong>{' '}
                  <span className="hint">@{other.username || '?'}</span>
                  <div className="hint">{c.lastMessage ? c.lastMessage.content.slice(0, 60) : 'No messages yet'}</div>
                </div>
                <Link className="btn" to={`/chat/${c._id}`}>Open</Link>
              </li>
            );
          })}
        </ul>
      </section>
      <p><Link to="/dashboard">← Dashboard</Link> · <Link to="/search">Find people</Link></p>
    </main>
  );
}
