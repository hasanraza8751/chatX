import { Link } from 'react-router-dom';

// Shown on desktop when no conversation is selected,
// and never on mobile detail view (router shows the chat instead).
export default function MessengerHome() {
  return (
    <div className="empty-chat">
      <div className="logo">CX</div>
      <h2>Select a conversation</h2>
      <p className="hint">Pick a chat on the left, or search above to start a new one.</p>
      <p>
        <Link className="btn" to="/search">Find people</Link>
      </p>
    </div>
  );
}
