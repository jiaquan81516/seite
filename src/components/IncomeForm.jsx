import { useState } from 'react';
import { createIncome } from '../lib/finance';

export function IncomeForm({ income, date, onSave, onDelete }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function handleSubmit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    setError('');
    try {
      await onSave(createIncome(fields, income));
    } catch (failure) {
      setError(failure.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <div className="entry-amount">
        <label htmlFor="income-amount">How much came in?</label>
        <div className="amount-input">
          <span>S$</span>
          <input
            id="income-amount"
            name="amount"
            aria-label="Amount (SGD)"
            inputMode="decimal"
            pattern="[0-9]+(\.[0-9]{1,2})?"
            defaultValue={income ? (income.amount_cents / 100).toFixed(2) : ''}
            placeholder="0.00"
            required
          />
        </div>
      </div>
      <label htmlFor="income-source">Source</label>
      <input
        className="field"
        id="income-source"
        name="source"
        defaultValue={income?.source ?? ''}
        placeholder="Salary, allowance, tutoring…"
        maxLength={120}
        required
        autoFocus
      />
      <label htmlFor="income-date">Date</label>
      <input
        className="field"
        id="income-date"
        name="date"
        type="date"
        defaultValue={income?.date ?? date}
        required
      />
      <label htmlFor="income-note">Note (optional)</label>
      <textarea
        className="field"
        id="income-note"
        name="note"
        rows={2}
        maxLength={500}
        defaultValue={income?.note ?? ''}
      />
      <p className="error" role="alert">
        {error}
      </p>
      <button className="primary full" type="submit" disabled={saving}>
        {saving ? 'Saving…' : income ? 'Save changes' : 'Save income'}
      </button>
      {income && (
        <button
          className="danger full"
          type="button"
          disabled={saving}
          onClick={onDelete}
        >
          Delete income
        </button>
      )}
    </form>
  );
}
