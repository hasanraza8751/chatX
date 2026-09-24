import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchUsers } from '../api/users.js';
import { createConversation } from '../api/conversations.js';
import { useDebounce } from '../hooks/useDebounce.js';
import Avatar from './Avatar.jsx';
import { SearchIcon } from './icons.jsx';

// Sidebar-integrated find-and-start-chat (debounced user search + create/get conversation).
// Same API logic — refined instant-search presentation only.
export default function NewChatSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(null);
  const [error, setError] = useState('');
  const debounced = useDebounce(query, 300);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const q = debounced.trim();
    if (q.length < 2) {
      setResults([]);
      setError('');
      return;
    }
    setBusy(true);
    searchUsers(q)
      .then((data) => {
        if (!cancelled) {
          setResults(data.users || []);
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

  const startChat = async (userId) => {
    setError('');
    setStarting(userId);
    try {
      const data = await createConversation(userId);
      setQuery('');
      setResults([]);
      navigate(`/messages/${data.conversation._id}`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not start chat.');
    } finally {
      setStarting(null);
    }
  };

  return (
    <div className="newchat">
      <div className="search-wrap">
        <SearchIcon />
        <input
          className="search-input"
          placeholder="Search people…"
          aria-label="Search people to chat"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>
      {busy && <p className="hint">Searching…</p>}
      {error && (
        <p className="error" role="alert">{error}</p>
      )}
      {debounced.trim().length >= 2 && !busy && !error && results.length === 0 && (
        <p className="hint">No people found.</p>
      )}
      {results.length > 0 && (
        <ul className="newchat-results">
          {results.map((u) => (
            <li key={u._id}>
              <Avatar name={u.name} size={34} />
              <span className="newchat-meta">
                <strong>{u.name}</strong>
                <span className="hint">@{u.username}</span>
              </span>
              <button className="btn small" disabled={starting === u._id} onClick={() => startChat(u._id)}>
                {starting === u._id ? '…' : 'Chat'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
