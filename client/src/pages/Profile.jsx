import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { updateMyProfile } from '../api/users.js';
import { LANGUAGES, TRANSLATION_MODES } from '../utils/languages.js';
import Avatar from '../components/Avatar.jsx';

// Own profile: same view + edit logic, clean settings layout.
export default function Profile() {
  const { user, setUser } = useAuth();
  const { connected } = useSocket();
  const [form, setForm] = useState({ name: user?.name || '', bio: user?.bio || '' });
  const [lang, setLang] = useState({
    preferredLanguage: user?.preferredLanguage || 'en',
    translationMode: user?.translationMode || 'off',
    translationTarget: user?.translationTarget || '',
  });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [langMsg, setLangMsg] = useState('');
  const [langError, setLangError] = useState('');
  const [langBusy, setLangBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setBusy(true);
    try {
      const data = await updateMyProfile({ name: form.name.trim(), bio: form.bio });
      // Merge server-returned public user into AuthContext (keeps email for session display).
      setUser((prev) => ({ ...prev, ...data.user }));
      setMsg('Profile updated.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  const onLangSubmit = async (e) => {
    e.preventDefault();
    setLangError('');
    setLangMsg('');
    setLangBusy(true);
    try {
      const data = await updateMyProfile({
        preferredLanguage: lang.preferredLanguage,
        translationMode: lang.translationMode,
        translationTarget: lang.translationTarget || null,
      });
      setUser((prev) => ({ ...prev, ...data.user }));
      setLangMsg('Language settings saved.');
    } catch (err) {
      setLangError(err?.response?.data?.message || 'Could not save language settings.');
    } finally {
      setLangBusy(false);
    }
  };

  return (
    <main className="page narrow">
      <div className="page-head">
        <h1>Profile</h1>
        <p>How you appear to other people.</p>
      </div>
      <section className="card">
        <div className="profile-hero">
          <Avatar name={user?.name} size={64} />
          <div className="who">
            <strong>{user?.name}</strong>
            <div className="meta">@{user?.username} · {user?.email}</div>
            <div className="status-line">
              {connected ? (<><span className="status-dot on" />Online</>) : (<><span className="status-dot off" />Offline</>)}
            </div>
          </div>
        </div>
        {user?.bio && <p className="bio-text">{user.bio}</p>}
      </section>
      <form className="card form" style={{ marginTop: 16 }} onSubmit={onSubmit}>
        <label className="field">
          <span>Name</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={50} />
        </label>
        <label className="field">
          <span>Bio</span>
          <input value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={200} placeholder="About you…" />
        </label>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {msg && <p className="inline-ok" role="status">{msg}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
      <form className="card form" style={{ marginTop: 16 }} onSubmit={onLangSubmit}>
        <div className="page-head" style={{ margin: 0 }}>
          <h1 style={{ fontSize: 17 }}>Language & translation</h1>
          <p>Others see your messages translated into their language; yours into mine.</p>
        </div>
        <label className="field">
          <span>My preferred language</span>
          <select value={lang.preferredLanguage} onChange={(e) => setLang({ ...lang, preferredLanguage: e.target.value })}>
            {Object.entries(LANGUAGES).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Translation mode</span>
          <div className="radio-col" role="radiogroup" aria-label="Translation mode">
            {Object.entries(TRANSLATION_MODES).map(([code, label]) => (
              <label key={code} className="radio-row">
                <input
                  type="radio"
                  name="translationMode"
                  value={code}
                  checked={lang.translationMode === code}
                  onChange={(e) => setLang({ ...lang, translationMode: e.target.value })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Translate messages to</span>
          <select value={lang.translationTarget} onChange={(e) => setLang({ ...lang, translationTarget: e.target.value })}>
            <option value="">Same as preferred language</option>
            {Object.entries(LANGUAGES).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Supported languages</span>
          <ul className="lang-list">
            {Object.entries(LANGUAGES).map(([code, label]) => (
              <li key={code}>{label}</li>
            ))}
          </ul>
        </div>
        {langError && <p className="inline-error" role="alert">{langError}</p>}
        {langMsg && <p className="inline-ok" role="status">{langMsg}</p>}
        <button className="btn primary" disabled={langBusy}>{langBusy ? 'Saving…' : 'Save language settings'}</button>
      </form>
      <p className="crumbs"><Link to="/dashboard">← Dashboard</Link> · <Link to="/messages">Messenger</Link></p>
    </main>
  );
}
