import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { searchUsers } from '../api/users.js';
import { createConversation } from '../api/conversations.js';
import { useDebounce } from '../hooks/useDebounce.js';
import Avatar from '../components/Avatar.jsx';
import { SearchIcon } from '../components/icons.jsx';

// Same search + create-conversation logic, minimal instant-feel layout.
export default function Search() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const debounced = useDebounce(query, 300);
  const navigate = useNavigate();
  const [starting, setStarting] = useState(null);

  const startChat = async (userId) => {
    setError('');
    setStarting(userId);
    try {
      const data = await createConversation(userId);
      navigate(`/messages/${data.conversation._id}`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not start chat.');
    } finally {
      setStarting(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const q = debounced.trim();
    if (q.length < 2) {
      setUsers([]);
      setError('');
      return;
    }
    setBusy(true);
    searchUsers(q)
      .then((data) => {
        if (!cancelled) {
          setUsers(data.users || []);
          setError('');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || 'Search failed.');
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const showEmpty = !busy && !error && debounced.trim().length >= 2 && users.length === 0;

  return (
    <main className="page narrow">
      <div className="page-head">
        <h1>Find people</h1>
        <p>Search by name or username to start chatting.</p>
      </div>
      <div className="card">
        <div className="search-wrap">
          <SearchIcon />
          <input
            className="search-input"
            placeholder="Search people…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search users"
            autoComplete="off"
          />
        </div>
        {busy && <div className="search-state"><span className="spin" aria-label="Searching" /></div>}
        {error && <p className="inline-error" style={{ marginTop: 12 }} role="alert">{error}</p>}
        {showEmpty && (
          <div className="search-state">
            <p><strong>No people found</strong></p>
            <p className="hint">Try a different name or username.</p>
          </div>
        )}
        {debounced.trim().length < 2 && !busy && (
          <div className="search-state"><p className="hint">Type at least 2 characters to search.</p></div>
        )}
        <ul className="results">
          {users.map((u) => (
            <li key={u._id} className="result">
              <div className="who">
                <Avatar name={u.name} size={40} />
                <div>
                  <strong>{u.name}</strong>
                  <div className="hint">@{u.username}{u.isOnline ? ' · Online' : ''}</div>
                </div>
              </div>
              <div className="row-actions">
                <Link className="btn small" to={`/users/${u._id}`}>View</Link>
                <button className="btn small primary" disabled={starting === u._id} onClick={() => startChat(u._id)}>
                  {starting === u._id ? '…' : 'Chat'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="crumbs"><Link to="/dashboard">← Dashboard</Link> · <Link to="/messages">Messenger</Link></p>
    </main>
  );
}
