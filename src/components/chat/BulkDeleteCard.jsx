import '../../bulk-delete.css';
import { useState } from 'react';
import { formatMoney, totalAmount } from '../../lib/money';
import { formatDate } from '../../lib/dates';
import { createBackup, downloadEntries } from '../../lib/backups';
import {
  BULK_CONFIRM_THRESHOLD,
  bulkRemovalText,
  describeFilter,
  needsTypedConfirmation,
} from '../../chat/bulk-delete';

const STATUS_TEXT = {
  applied: 'Removed. You can undo this or download a backup of these entries.',
  undone: 'Undone. The entries are back in your tracker.',
  cancelled: 'Cancelled. Your tracker was not changed.',
};

export function BulkDeleteCard({ message, disabled, onApply, onCancel, onUndo }) {
  const action = message.action;
  const pending = action.status === 'pending';
  const [selected, setSelected] = useState(
    () => new Set(action.matches.map((entry) => entry.id)),
  );
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = disabled || busy;
  const chosen = action.matches.filter((entry) => selected.has(entry.id));
  const strong = needsTypedConfirmation(chosen.length);
  const confirmed = !strong || typed.trim() === String(chosen.length);
  const shown = pending ? action.matches : action.removed;

  async function run(operation) {
    setBusy(true);
    setError('');
    try {
      await operation();
    } catch (failure) {
      setError(failure.message || 'Could not complete this action. Try again.');
    } finally {
      setBusy(false);
    }
  }
  function toggle(id) {
    setTyped('');
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function setAll(all) {
    setTyped('');
    setSelected(new Set(all ? action.matches.map((entry) => entry.id) : []));
  }
  function downloadBackup() {
    try {
      downloadEntries(createBackup(action.removed), 'json', 'application/json');
    } catch {
      setError('Could not create the backup file. Nothing was changed.');
    }
  }

  return (
    <section
      className={`entry-action-card bulk-delete-card action-${action.status}`}
      aria-label="Bulk removal"
    >
      <div className="entry-action-heading">
        <span aria-hidden="true">−</span>
        <div>
          <h3>Remove several entries</h3>
          <p>
            {pending
              ? `Matching: ${describeFilter(action.filter)}`
              : STATUS_TEXT[action.status]}
          </p>
        </div>
      </div>
      <fieldset className="bulk-list" disabled={!pending || locked}>
        <legend>
          {pending
            ? `Entries to remove (${action.matches.length} found)`
            : `Removed entries (${shown.length})`}
        </legend>
        {pending && (
          <div className="bulk-select-all">
            <button
              type="button"
              className="outline"
              onClick={() => setAll(chosen.length !== action.matches.length)}
            >
              {chosen.length === action.matches.length ? 'Untick all' : 'Tick all'}
            </button>
          </div>
        )}
        <ul>
          {shown.map((entry) => (
            <li key={entry.id}>
              <label>
                {pending && (
                  <input
                    type="checkbox"
                    checked={selected.has(entry.id)}
                    onChange={() => toggle(entry.id)}
                  />
                )}
                <span className="bulk-entry">
                  <strong>{entry.merchant}</strong>
                  <small>
                    {formatDate(entry.date)} · {entry.category} · {entry.method}
                  </small>
                </span>
                <span className="bulk-amount">{formatMoney(entry.amount_cents)}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {pending && (
        <p className="bulk-total" role="status">
          {chosen.length} of {action.matches.length} selected ·{' '}
          {formatMoney(totalAmount(chosen))}
        </p>
      )}
      {pending && strong && (
        <div className="bulk-confirm">
          <label htmlFor={`bulk-${message.id}`}>
            This removes {chosen.length} entries. Type <strong>{chosen.length}</strong> to
            confirm.
          </label>
          <input
            id={`bulk-${message.id}`}
            inputMode="numeric"
            autoComplete="off"
            value={typed}
            disabled={locked}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
      )}
      {pending && !strong && chosen.length > 0 && (
        <p className="field-help">
          Removing {BULK_CONFIRM_THRESHOLD} or more entries asks you to type the count.
          You can undo any removal.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="review-actions">
        {pending && (
          <>
            <button
              type="button"
              className="danger"
              disabled={locked || !chosen.length || !confirmed}
              onClick={() =>
                run(() =>
                  onApply(
                    message.id,
                    chosen.map((entry) => entry.id),
                    typed,
                  ),
                )
              }
            >
              Remove {bulkRemovalText(chosen)}
            </button>
            <button
              type="button"
              className="outline"
              disabled={locked}
              onClick={() => run(() => onCancel(message.id))}
            >
              Cancel
            </button>
          </>
        )}
        {action.status === 'applied' && (
          <>
            <button
              type="button"
              className="outline"
              disabled={locked}
              onClick={() => run(() => onUndo(message.id))}
            >
              Undo
            </button>
            <button type="button" className="outline" onClick={downloadBackup}>
              Download backup
            </button>
          </>
        )}
      </div>
    </section>
  );
}
