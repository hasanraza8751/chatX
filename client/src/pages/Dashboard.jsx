import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

// Phase 2 placeholder: proves ProtectedRoute + persistent login work.
// Conversations/messaging arrive in Phases 3–5.
export default function Dashboard() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <main className="page">
      <h1>Welcome, {user?.name}</h1>
      <section className="card">
        <p>@{user?.username} · {user?.email}</p>
        <p>Socket: {connected ? 'connected · live' : 'not connected (login required for socket)'}</p>
      </section>
      <div className="actions">
        <Link className="btn primary" to="/messages">Open Messenger</Link>
        <Link className="btn" to="/search">Find people</Link>
        <Link className="btn" to="/profile">My profile</Link>
        <button className="btn" onClick={onLogout}>Logout</button>
      </div>
    </main>
  );
}
