import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Search from './pages/Search.jsx';
import Profile from './pages/Profile.jsx';
import UserProfile from './pages/UserProfile.jsx';
import MessengerLayout from './layouts/MessengerLayout.jsx';
import MessengerHome from './pages/MessengerHome.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/users/:id" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><MessengerLayout /></ProtectedRoute>}>
          <Route index element={<MessengerHome />} />
          <Route path=":id" element={<ChatWindow />} />
        </Route>
        {/* Legacy routes redirect into the messenger shell (same behavior, polished UI). */}
        <Route path="/conversations" element={<Navigate to="/messages" replace />} />
        <Route path="/chat/:id" element={<LegacyChatRedirect />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  );
}

function LegacyChatRedirect() {
  const { id } = useParams();
  return <Navigate to={`/messages/${id}`} replace />;
}
