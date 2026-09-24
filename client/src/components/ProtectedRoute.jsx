import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Blocks unauthenticated access + shows a calm loader while /me resolves (persistent login).
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <main className="page narrow">
        <div className="center-state" aria-label="Loading">
          <span className="spin" />
          <p className="hint">Loading…</p>
        </div>
      </main>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
