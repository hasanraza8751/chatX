import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getUser } from '../api/users.js';
import Avatar from '../components/Avatar.jsx';

// Public profile: same safe fields from GET /api/users/:id, cleaner layout.
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
    <main className="page narrow">
      <div className="page-head">
        <h1>Profile</h1>
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {!error && !data && (
        <section className="card"><p className="hint">Loading profile…</p></section>
      )}
      {data && (
        <section className="card">
          <div className="profile-hero">
            <Avatar name={data.name} size={64} />
            <div className="who">
              <strong>{data.name}</strong>
              <div className="meta">@{data.username}</div>
              <div className="status-line">
                {data.isOnline ? (<><span className="status-dot on" />Online</>) : (<><span className="status-dot off" />Offline</>)}
              </div>
            </div>
          </div>
          <p className="bio-text">{data.bio || 'No bio yet.'}</p>
        </section>
      )}
      <p className="crumbs"><Link to="/search">← Search</Link> · <Link to="/dashboard">Dashboard</Link></p>
    </main>
  );
}
