import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getUser } from '../api/users.js';

// Public profile: shows only safe fields returned by GET /api/users/:id.
export default function UserProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getUser(id)
      .then((d) => {
        if (!cancelled) setData(d.user);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || 'User not found.');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className="page">
      <h1>Profile</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {data && (
        <section className="card">
          <p><strong>{data.name}</strong> <span className="hint">@{data.username}</span></p>
          <p>{data.bio || 'No bio yet.'}</p>
          <p className="hint">{data.isOnline ? '● Online' : 'Offline'}</p>
          <p className="hint">Start Chat arrives in Phase 4 (no messaging yet).</p>
        </section>
      )}
      <p><Link to="/search">← Search</Link> · <Link to="/dashboard">Dashboard</Link></p>
    </main>
  );
}
