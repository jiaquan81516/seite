import { useState } from 'react';
import { Modal } from '../Modal';
export function DeleteLocalDataDialog({ busy, error, onBackup, onDelete, onClose }) {
  const [confirmation, setConfirmation] = useState('');
  function handleSubmit(event) {
    event.preventDefault();
    if (confirmation === 'DELETE') onDelete();
  }
  return (
    <Modal title="Delete all local data?" onClose={onClose} dismissible={!busy}>
      <p>
        All entries, chat history, learned merchant categories, your profile and
        preferences will be removed from this browser. Save an entries backup first if you
        want to keep your spending history.
      </p>
      <button className="outline" disabled={busy} onClick={onBackup}>
        Download backup first
      </button>
      <form onSubmit={handleSubmit}>
        <label htmlFor="delete-confirmation">Type DELETE to confirm</label>
        <input
          className="field"
          id="delete-confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          required
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="settings-actions">
          <button className="danger" disabled={busy || confirmation !== 'DELETE'}>
            {busy ? 'Deleting…' : 'Permanently delete local data'}
          </button>
          <button className="outline" type="button" disabled={busy} onClick={onClose}>
            Keep my data
          </button>
        </div>
      </form>
    </Modal>
  );
}
