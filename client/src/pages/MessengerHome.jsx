import { Link } from 'react-router-dom';
import { ChatIcon } from '../components/icons.jsx';

// Shown on desktop when no conversation is selected,
// and never on mobile detail view (router shows the chat instead).
export default function MessengerHome() {
  return (
    <div className="empty-chat">
      <div className="empty-art" aria-hidden="true"><ChatIcon /></div>
      <h2>Select a conversation</h2>
      <p className="hint">Choose a person from the sidebar to start chatting.</p>
      <Link className="btn" to="/search">Find people</Link>
    </div>
  );
}
