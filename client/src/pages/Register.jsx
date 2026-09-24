import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Same registration logic — minimal premium layout only.
export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await register({ name: form.name, username: form.username, email: form.email, password: form.password });
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed. Please try again.');
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
        <h1>Create your account</h1>
        <p className="auth-sub">Start messaging in seconds.</p>
        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            <span>Name</span>
            <input name="name" value={form.name} onChange={onChange} autoComplete="name" placeholder="Your name" required maxLength={50} />
          </label>
          <label className="field">
            <span>Username</span>
            <input name="username" value={form.username} onChange={onChange} autoComplete="username" placeholder="username" required minLength={3} maxLength={20} />
          </label>
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" value={form.email} onChange={onChange} autoComplete="email" placeholder="you@example.com" required />
          </label>
          <label className="field">
            <span>Password</span>
            <input name="password" type="password" value={form.password} onChange={onChange} autoComplete="new-password" placeholder="Min. 8 characters" required minLength={8} />
          </label>
          <label className="field">
            <span>Confirm password</span>
            <input name="confirm" type="password" value={form.confirm} onChange={onChange} autoComplete="new-password" placeholder="Repeat password" required />
          </label>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        </form>
        <p className="auth-foot">
          Have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
