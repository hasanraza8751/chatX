import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

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
    <main className="page">
      <h1>Create account</h1>
      <form className="card form" onSubmit={onSubmit}>
        <label>Name<input name="name" value={form.name} onChange={onChange} required maxLength={50} /></label>
        <label>Username<input name="username" value={form.username} onChange={onChange} required minLength={3} maxLength={20} /></label>
        <label>Email<input name="email" type="email" value={form.email} onChange={onChange} required /></label>
        <label>Password<input name="password" type="password" value={form.password} onChange={onChange} required minLength={8} /></label>
        <label>Confirm password<input name="confirm" type="password" value={form.confirm} onChange={onChange} required /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Register'}</button>
      </form>
      <p><Link to="/login">Have an account? Login</Link> · <Link to="/">← Home</Link></p>
    </main>
  );
}
