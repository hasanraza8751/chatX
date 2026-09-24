import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Same login logic — minimal premium layout only.
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.identifier, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="logo">CX</span>
          <strong>ChatX</strong>
        </div>
        <h1>Welcome back</h1>
        <p className="auth-sub">Log in to continue your conversations.</p>
        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            <span>Email or username</span>
            <input
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              autoComplete="username"
              placeholder="you@example.com"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </label>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Logging in…' : 'Login'}</button>
        </form>
        <p className="auth-foot">
          New to ChatX? <Link to="/register">Create account</Link>
        </p>
      </div>
    </main>
  );
}
