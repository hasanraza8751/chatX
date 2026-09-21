import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Blocks unauthenticated access + shows loading while /me resolves (persistent login).
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
