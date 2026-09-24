import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { updateMyProfile } from '../api/users.js';
import Avatar from '../components/Avatar.jsx';

// Own profile: same view + edit logic, clean settings layout.
export default function Profile() {
  const { user, setUser } = useAuth();
  const { connected } = useSocket();
  const [form, setForm] = useState({ name: user?.name || '', bio: user?.bio || '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setBusy(true);
    try {
      const data = await updateMyProfile({ name: form.name.trim(), bio: form.bio });
      // Merge server-returned public user into AuthContext (keeps email for session display).
      setUser((prev) => ({ ...prev, ...data.user }));
      setMsg('Profile updated.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page narrow">
      <div className="page-head">
        <h1>Profile</h1>
        <p>How you appear to other people.</p>
      </div>
      <section className="card">
        <div className="profile-hero">
          <Avatar name={user?.name} size={64} />
          <div className="who">
            <strong>{user?.name}</strong>
            <div className="meta">@{user?.username} · {user?.email}</div>
            <div className="status-line">
              {connected ? (<><span className="status-dot on" />Online</>) : (<><span className="status-dot off" />Offline</>)}
            </div>
          </div>
        </div>
        {user?.bio && <p className="bio-text">{user.bio}</p>}
      </section>
      <form className="card form" style={{ marginTop: 16 }} onSubmit={onSubmit}>
        <label className="field">
          <span>Name</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={50} />
        </label>
        <label className="field">
          <span>Bio</span>
          <input value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={200} placeholder="About you…" />
        </label>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {msg && <p className="inline-ok" role="status">{msg}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
      <p className="crumbs"><Link to="/dashboard">← Dashboard</Link> · <Link to="/messages">Messenger</Link></p>
    </main>
  );
}
