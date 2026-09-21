import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { searchUsers } from '../api/users.js';
import { createConversation } from '../api/conversations.js';
import { useDebounce } from '../hooks/useDebounce.js';

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
      navigate(`/chat/${data.conversation._id}`);
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

  return (
    <main className="page">
      <h1>Find people</h1>
      <div className="card">
        <input
          className="search-input"
          placeholder="Search username or name (min 2 chars)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search users"
        />
        {busy && <p>Searching…</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {!busy && !error && debounced.trim().length >= 2 && users.length === 0 && (
          <p className="hint">No users found.</p>
        )}
        <ul className="results">
          {users.map((u) => (
            <li key={u._id} className="result">
              <div>
                <strong>{u.name}</strong> <span className="hint">@{u.username}</span>
                <div className="hint">{u.bio || '—'}{u.isOnline ? ' · ● Online' : ''}</div>
              </div>
              <div className="row-actions">
                <Link className="btn" to={`/users/${u._id}`}>View</Link>
                <button className="btn primary" disabled={starting === u._id} onClick={() => startChat(u._id)}>
                  {starting === u._id ? '…' : 'Start Chat'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p><Link to="/dashboard">← Dashboard</Link></p>
    </main>
  );
}
