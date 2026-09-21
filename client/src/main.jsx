import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import './styles/messenger.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { PresenceProvider } from './context/PresenceContext.jsx';
import { ChatProvider } from './context/ChatContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <SocketProvider>
        <PresenceProvider>
          <ChatProvider>
            <App />
          </ChatProvider>
        </PresenceProvider>
      </SocketProvider>
    </AuthProvider>
  </StrictMode>
);
