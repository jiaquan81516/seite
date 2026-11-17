import '../../restore.css';
import { useState } from 'react';
import { formatMoney } from '../../lib/money';
import { formatDate } from '../../lib/dates';
import { restoreText } from '../../chat/restore';

const SHOWN = 6;
const STATUS_TEXT = {
  applied: 'Restored. The entries are back in your tracker.',
  cancelled: 'Cancelled. Your tracker was not changed.',
};

export function RestoreCard({ message, disabled, onApply, onCancel }) {
  const action = message.action;
  const pending = action.status === 'pending';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = disabled || busy;
  async function run(operation) {
    setBusy(true);
    setError('');
    try {
      await operation();
    } catch (failure) {
      setError(failure.message || 'Could not restore these entries. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={`entry-action-card action-${action.status === 'applied' ? 'undone' : action.status}`}
      aria-label="Restore entries"
    >
      <div className="entry-action-heading">
        <span aria-hidden="true">↺</span>
        <div>
          <h3>Restore removed entries</h3>
          <p>
            {pending
              ? `Your most recent removal: ${restoreText(action.entries)}.`
              : STATUS_TEXT[action.status]}
          </p>
        </div>
      </div>
      <ul className="restore-list">
        {action.entries.slice(0, SHOWN).map((entry) => (
          <li key={entry.id}>
            <span>
              <strong>{entry.merchant}</strong>
              <small>
                {formatDate(entry.date)} · {entry.category}
              </small>
            </span>
            <span>{formatMoney(entry.amount_cents)}</span>
          </li>
        ))}
      </ul>
      {action.entries.length > SHOWN && (
        <p className="field-help">and {action.entries.length - SHOWN} more.</p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {pending && (
        <div className="review-actions">
          <button
            type="button"
            className="primary"
            disabled={locked}
            onClick={() => run(() => onApply(message.id))}
          >
            Restore {restoreText(action.entries)}
          </button>
          <button
            type="button"
            className="outline"
            disabled={locked}
            onClick={() => run(() => onCancel(message.id))}
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}
