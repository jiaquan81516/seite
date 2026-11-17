import { useState } from 'react';
import { useAccount } from '../../account/AccountProvider';
import { AVATAR_COLORS } from '../../lib/account';
import { Avatar } from './Avatar';
export function ProfileSettings() {
  const { profile, saveAccount } = useAccount();
  const [draft, setDraft] = useState(profile);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  function change(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setMessage('');
    setError('');
  }
  function save(event) {
    event.preventDefault();
    try {
      const next = { ...draft, name: draft.name.trim(), email: draft.email.trim() };
      saveAccount({ profile: next });
      setDraft(next);
      setMessage('Profile saved on this device.');
      setError('');
    } catch (error) {
      setError(error.message);
    }
  }
  return (
    <section className="panel account-panel">
      <div className="profile-preview">
        <Avatar profile={draft} large />
        <div>
          <h2>{draft.name.trim() || 'Your name'}</h2>
        </div>
      </div>
      <form onSubmit={save}>
        <label htmlFor="profile-name">Display name (optional)</label>
        <input
          className="field"
          id="profile-name"
          autoComplete="nickname"
          value={draft.name}
          maxLength={80}
          placeholder="What should we call you?"
          onChange={(event) => change('name', event.target.value)}
        />
        <label htmlFor="profile-email">Profile email (optional)</label>
        <input
          className="field"
          id="profile-email"
          type="email"
          autoComplete="email"
          value={draft.email}
          maxLength={254}
          placeholder="you@example.com"
          aria-describedby="profile-email-note"
          onChange={(event) => change('email', event.target.value)}
        />
        <p className="field-help" id="profile-email-note">
          Saved only on this device. This doesn’t change a login or connect your inbox.
        </p>
        <fieldset className="avatar-colors">
          <legend>Pick your colour</legend>
          {AVATAR_COLORS.map((color) => (
            <label key={color} className={`color-choice avatar-${color.toLowerCase()}`}>
              <input
                type="radio"
                name="avatar-color"
                value={color}
                checked={draft.color === color}
                onChange={() => change('color', color)}
              />
              <span>{color}</span>
            </label>
          ))}
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="save-feedback" role="status">
          {message}
        </p>
        <div className="settings-actions">
          <button className="primary" disabled={!dirty}>
            Save profile
          </button>
          <button
            className="outline"
            type="button"
            disabled={!dirty}
            onClick={() => {
              setDraft(profile);
              setMessage('Changes discarded.');
              setError('');
            }}
          >
            Discard changes
          </button>
          {dirty && <span className="field-help">Unsaved changes</span>}
        </div>
      </form>
    </section>
  );
}
