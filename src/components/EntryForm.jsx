import { useState } from 'react';
import { SelectField } from './SelectField';
import { TimeField } from './TimeField';
import { CATEGORIES, PAYMENT_METHODS } from '../lib/config';
import { formatDate } from '../lib/dates';
import { createEntry } from '../lib/transactions';
export function EntryForm({ entry, date, defaultMethod = '', onSave, onDelete }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function handleSubmit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    setError('');
    try {
      await onSave(createEntry(fields, entry));
    } catch (error) {
      setError(error.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <div className="entry-amount">
        <label htmlFor="amount">How much did you spend?</label>
        <div className="amount-input">
          <span>S$</span>
          <input
            id="amount"
            name="amount"
            aria-label="Amount (SGD)"
            inputMode="decimal"
            pattern="[0-9]+(\.[0-9]{1,2})?"
            defaultValue={entry ? (entry.amount_cents / 100).toFixed(2) : ''}
            placeholder="0.00"
            required
          />
        </div>
        <span className="entry-currency">Singapore dollars</span>
      </div>
      <label htmlFor="merchant">Merchant</label>
      <input
        className="field"
        id="merchant"
        name="merchant"
        defaultValue={entry?.merchant ?? ''}
        placeholder="Where did you spend?"
        maxLength={160}
        required
        autoFocus
      />
      <div className="form-grid">
        <div>
          <label htmlFor="date">Transaction date</label>
          <input
            className="field"
            id="date"
            name="date"
            type="date"
            defaultValue={entry?.date ?? date}
            required
          />
        </div>
        <div>
          <label htmlFor="time">Time (optional)</label>
          <TimeField id="time" name="time" defaultValue={entry?.time ?? ''} />
        </div>
      </div>
      <label htmlFor="category">Category</label>
      <SelectField
        id="category"
        name="category"
        defaultValue={entry?.category ?? ''}
        options={CATEGORIES}
        placeholder="Choose a category"
        required
      />
      <label htmlFor="method">Payment method</label>
      <SelectField
        id="method"
        name="method"
        defaultValue={entry?.method ?? defaultMethod}
        options={PAYMENT_METHODS}
        placeholder="Choose a method"
        required
      />
      <label htmlFor="note">Note (optional)</label>
      <textarea
        className="field"
        id="note"
        name="note"
        rows={2}
        placeholder="Anything you’d like to remember?"
        maxLength={2000}
        defaultValue={entry?.note ?? ''}
      />
      {entry && (
        <label className="chat-check">
          <input
            type="checkbox"
            name="refunded"
            defaultChecked={Boolean(entry.refunded)}
          />
          Mark this spend as refunded (excluded from totals)
        </label>
      )}
      {entry && (
        <p className="muted">
          Source: {entry.source} · Saved {formatDate(entry.created_at.slice(0, 10))}
        </p>
      )}
      <p className="error" role="alert">
        {error}
      </p>
      <button className="primary full" type="submit" disabled={saving}>
        {saving ? 'Saving…' : entry ? 'Save changes' : 'Save spend'}
      </button>
      {entry && (
        <button
          className="danger full"
          type="button"
          disabled={saving}
          onClick={onDelete}
        >
          Delete spend
        </button>
      )}
    </form>
  );
}
