import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import Avatar from '../components/Avatar.jsx';
import { ChatIcon, PeopleIcon, UserIcon, LogoutIcon } from '../components/icons.jsx';

// Same data + logout logic. Compact dashboard with human-friendly status.
export default function Dashboard() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <main className="page narrow">
      <div className="page-head">
        <h1>Home</h1>
        <p>Your messaging hub.</p>
      </div>
      <div className="dash-grid">
        <section className="card user-card">
          <Avatar name={user?.name} size={56} />
          <div className="who">
            <strong>{user?.name}</strong>
            <span>@{user?.username} · {user?.email}</span>
            <div className="status-line">
              {connected ? (
                <><span className="status-dot on" />Connected</>
              ) : user ? (
                <><span className="status-dot mid" />Connecting…</>
              ) : (
                <><span className="status-dot off" />Offline</>
              )}
            </div>
          </div>
        </section>
        <nav className="card dash-actions" aria-label="Primary">
          <Link className="btn primary" to="/messages"><ChatIcon />Open Messenger</Link>
          <Link className="btn" to="/search"><PeopleIcon />Find people</Link>
          <Link className="btn" to="/profile"><UserIcon />My profile</Link>
          <button className="btn danger" onClick={onLogout}><LogoutIcon />Logout</button>
        </nav>
      </div>
    </main>
  );
}
