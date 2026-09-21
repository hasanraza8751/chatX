import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';

// Phase 1 landing: proves frontend -> backend wiring via /api/health.
// Later this becomes the marketing page from PRD 7.1.
export default function Landing() {
  const [health, setHealth] = useState({ state: 'checking' });

  useEffect(() => {
    let cancelled = false;
    api
      .get('/health')
      .then((res) => {
        if (!cancelled) setHealth({ state: 'ok', data: res.data });
      })
      .catch((err) => {
        if (!cancelled) {
          setHealth({
            state: 'error',
            message: err?.response?.data?.message || err.message,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="page">
      <header className="brand">
        <div className="logo">CX</div>
        <div>
          <h1>ChatX</h1>
          <p>Real-time messaging — Phase 1 setup</p>
        </div>
      </header>

      <section className="card">
        <h2>Backend status</h2>
        {health.state === 'checking' && <p>Checking http://localhost:5000/api/health…</p>}
        {health.state === 'ok' && (
          <p className="ok">
            Connected — {health.data.service} ({health.data.env}) at {health.data.time}
          </p>
        )}
        {health.state === 'error' && (
          <p className="error">
            Backend not reachable: {health.message}. Start it with <code>npm run dev</code> in{' '}
            <code>server/</code>.
          </p>
        )}
      </section>

      <nav className="actions">
        <Link className="btn primary" to="/register">
          Get Started
        </Link>
        <Link className="btn" to="/login">
          Login
        </Link>
      </nav>

      <p className="hint">Auth + chat screens land in Phases 2–5. This page only verifies wiring.</p>
    </main>
  );
}
