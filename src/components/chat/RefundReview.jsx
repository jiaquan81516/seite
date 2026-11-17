import { SelectField } from '../SelectField';
import { useState } from 'react';
import { formatMoney } from '../../lib/money';
export function RefundReview({ candidate, entries, onRefund, disabled }) {
  const [selected, setSelected] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const amount = candidate.amount === null ? null : Math.round(candidate.amount * 100);
  const matches = entries.filter(
    (entry) =>
      !entry.refunded &&
      amount > 0 &&
      ((candidate.currency === 'SGD' && entry.amount_cents === amount) ||
        (candidate.currency === entry.currency &&
          entry.original_amount_cents === amount)),
  );
  async function apply() {
    try {
      setError('');
      await onRefund(selected);
    } catch (error) {
      setError(error.message || 'The original spend could not be updated.');
    }
  }
  if (candidate.saved)
    return <p className="save-feedback">✓ Original spend marked as refunded.</p>;
  if (!matches.length)
    return (
      <p className="field-help">
        No saved spend matches this full refund. For a partial or unclear refund, edit the
        original spend in the tracker; nothing is added as new spending.
      </p>
    );
  return (
    <div className="refund-review">
      <p>
        Match this to its original spend. The original stays in your history and is
        excluded from spending totals.
      </p>
      <label htmlFor={`refund-${candidate.id}`}>Original spend</label>
      <SelectField
        id={`refund-${candidate.id}`}
        value={selected}
        disabled={disabled}
        onValueChange={(value) => {
          setSelected(value);
          setConfirmed(false);
        }}
        placeholder="Choose the original spend"
        options={matches.map((entry) => ({
          value: entry.id,
          label: `${entry.merchant} · ${formatMoney(entry.amount_cents)} · ${entry.date}`,
        }))}
      />
      <label className="chat-check">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={disabled}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        This is a full refund of that spend.
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button
        className="outline"
        disabled={disabled || !selected || !confirmed}
        onClick={apply}
      >
        Mark original as refunded
      </button>
    </div>
  );
}
