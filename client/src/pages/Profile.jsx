import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { updateMyProfile } from '../api/users.js';

// Own profile: view + edit name/bio. Avatar is a placeholder (no uploads in Phase 3).
export default function Profile() {
  const { user, setUser } = useAuth();
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
    <main className="page">
      <h1>My profile</h1>
      <section className="card">
        <p><strong>{user?.name}</strong> <span className="hint">@{user?.username}</span></p>
        <p className="hint">{user?.email} · Avatar: placeholder</p>
      </section>
      <form className="card form" onSubmit={onSubmit}>
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={50} /></label>
        <label>Bio<input value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={200} placeholder="About you…" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        {msg && <p className="ok">{msg}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </form>
      <p><Link to="/dashboard">← Dashboard</Link> · <Link to="/search">Find people</Link></p>
    </main>
  );
}
