import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useChat } from '../context/ChatContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

export default function Chat() {
  const { id } = useParams();
  const { user } = useAuth();
  const { connected } = useSocket();
  const { messagesByConv, loadHistory, sendMessage, setActiveId } = useChat();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const messages = messagesByConv[id] || [];

  // Open = load history from REST (reconnect recovery relies on this, not socket replay).
  useEffect(() => {
    setActiveId(id);
    loadHistory(id, 1, 30).catch((err) => {
      setError(err?.response?.data?.message || 'Could not load messages.');
    });
    return () => setActiveId(null);
  }, [id, loadHistory, setActiveId]);

  const onSend = async (e) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    setError('');
    setBusy(true);
    try {
      await sendMessage(id, content);
      setDraft('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Message could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page chat">
      <p><Link to="/conversations">← Chats</Link> <span className="hint">{connected ? '· live' : '· reconnecting…'}</span></p>
      <section className="card thread" aria-live="polite">
        {messages.map((m) => {
          const mine = String(m.senderId) === String(user?._id);
          return (
            <div key={m._id} className={mine ? 'bubble mine' : 'bubble theirs'}>
              <div>{m.content}</div>
              <div className="meta">{new Date(m.createdAt).toLocaleTimeString()}</div>
            </div>
          );
        })}
        {messages.length === 0 && <p className="hint">No messages yet. Say hello.</p>}
      </section>
      {error && <p className="error" role="alert">{error}</p>}
      <form className="composer" onSubmit={onSend}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          aria-label="Type a message"
          maxLength={2000}
        />
        <button className="btn primary" disabled={busy || !draft.trim()}>
          {busy ? '…' : 'Send'}
        </button>
      </form>
    </main>
  );
}
