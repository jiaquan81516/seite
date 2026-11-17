import { Modal } from '../Modal';
import { formatMoney, totalAmount } from '../../lib/money';
export function RestoreBackupDialog({ review, busy, error, onRestore, onClose }) {
  return (
    <Modal title="Restore these entries?" onClose={onClose} dismissible={!busy}>
      <p>
        <strong>{review.added.length} new entries</strong> will be added, totalling{' '}
        {formatMoney(totalAmount(review.added))}. {review.skipped} already-saved entries
        will be skipped.
      </p>
      <p className="muted">
        Your existing entries, profile and preferences stay as they are.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="settings-actions">
        <button className="primary" disabled={busy} onClick={onRestore}>
          {busy ? 'Restoring…' : 'Restore entries'}
        </button>
        <button className="outline" disabled={busy} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
