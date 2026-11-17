import { useState } from 'react';
export function DeleteConfirmation({ entry, onDelete, onCancel }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  async function confirmDelete() {
    setDeleting(true);
    try {
      await onDelete(entry.id);
    } catch {
      setError('Could not delete. Please try again.');
      setDeleting(false);
    }
  }
  return (
    <>
      <p>{entry.merchant} will be removed from this device.</p>
      <p className="error" role="alert">
        {error}
      </p>
      <button className="danger full" disabled={deleting} onClick={confirmDelete}>
        {deleting ? 'Deleting…' : 'Delete spend'}
      </button>
      <button className="outline full" disabled={deleting} onClick={onCancel}>
        Cancel
      </button>
    </>
  );
}
