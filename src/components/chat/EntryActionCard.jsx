import { useState } from 'react';
import { SelectField } from '../SelectField';
import { formatMoney } from '../../lib/money';
import { formatDate } from '../../lib/dates';

const fieldNames = {
  merchant: 'Merchant',
  amount_cents: 'Amount (SGD)',
  date: 'Date',
  time: 'Time',
  category: 'Category',
  method: 'Payment method',
  note: 'Note',
};
function display(field, value) {
  if (field === 'amount_cents') return formatMoney(value);
  if (field === 'date') return formatDate(value);
  return value || 'None';
}
export function EntryActionCard({ message, disabled, onApply, onCancel, onUndo }) {
  const action = message.action;
  const [selected, setSelected] = useState(action.targetId);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const entry = action.options.find((item) => item.id === selected) || action.before;
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
  const pending = action.status === 'pending';
  const locked = disabled || busy;
  return (
    <section
      className={`entry-action-card action-${action.status}`}
      aria-label="Entry action"
    >
      <div className="entry-action-heading">
        <span aria-hidden="true">{action.type === 'delete' ? '−' : '↗'}</span>
        <div>
          <h3>{action.type === 'delete' ? 'Remove an entry' : 'Update an entry'}</h3>
          <p>
            {pending
              ? 'Check the details before applying.'
              : action.status === 'applied'
                ? 'Your tracker has been updated.'
                : action.status === 'undone'
                  ? 'Undone. Your original entry is back.'
                  : 'Cancelled. Your tracker was not changed.'}
          </p>
        </div>
      </div>
      {pending && !action.targetId && (
        <div className="entry-action-target">
          <label htmlFor={`action-${message.id}`}>Which entry did you mean?</label>
          <SelectField
            id={`action-${message.id}`}
            value={selected}
            disabled={locked}
            onValueChange={setSelected}
            placeholder="Choose a saved entry"
            options={action.options.map((item) => ({
              value: item.id,
              label: `${item.merchant} · ${formatMoney(item.amount_cents)} · ${formatDate(item.date)}`,
            }))}
          />
        </div>
      )}
      {entry && (
        <div className="entry-action-summary">
          <strong>{entry.merchant}</strong>
          <span>
            {formatMoney(entry.amount_cents)} · {formatDate(entry.date)}
          </span>
          <small>
            {entry.category} · {entry.method}
          </small>
        </div>
      )}
      {pending && action.type === 'update' && entry && (
        <dl className="entry-action-changes">
          {Object.entries(action.changes).map(([field, value]) => (
            <div key={field}>
              <dt>{fieldNames[field]}</dt>
              <dd>
                <del>{display(field, entry[field])}</del>
                <span aria-hidden="true"> → </span>
                <strong>{display(field, value)}</strong>
              </dd>
            </div>
          ))}
        </dl>
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
              className={action.type === 'delete' ? 'danger' : 'primary'}
              disabled={locked || !entry}
              onClick={() => run(() => onApply(message.id, selected))}
            >
              {action.type === 'delete' ? 'Remove entry' : 'Apply changes'}
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
          <button
            type="button"
            className="outline"
            disabled={locked}
            onClick={() => run(() => onUndo(message.id))}
          >
            Undo
          </button>
        )}
      </div>
    </section>
  );
}
