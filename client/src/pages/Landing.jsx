import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';

// Landing: same /api/health wiring, calmer premium presentation.
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
    <main className="page narrow">
      <header className="brand">
        <div className="logo">CX</div>
        <div>
          <h1>ChatX</h1>
          <p>Real-time messaging, minus the noise.</p>
        </div>
      </header>

      <section className="card">
        <div className="status-line" role="status">
          {health.state === 'checking' && (<><span className="status-dot mid" />Checking connection…</>)}
          {health.state === 'ok' && (<><span className="status-dot on" />Connected · {health.data.service} ({health.data.env})</>)}
          {health.state === 'error' && (<><span className="status-dot off" />Backend unreachable: {health.message}</>)}
        </div>
      </section>

      <nav className="actions">
        <Link className="btn primary" to="/register">Get started</Link>
        <Link className="btn" to="/login">Log in</Link>
      </nav>

      <p className="hint">Fast, private conversations with the people who matter.</p>
    </main>
  );
}
