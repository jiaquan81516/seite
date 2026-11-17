import { useState } from 'react';
import { SelectField } from './SelectField';
import { BILL_KINDS, createBill } from '../lib/finance';

const KIND_LABELS = {
  recurring: 'Recurring',
  instalment: 'Instalment',
  'one-off': 'One-off',
};

export function BillForm({ bill, month, onSave, onDelete }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function handleSubmit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    setError('');
    try {
      await onSave(createBill(fields, bill));
    } catch (failure) {
      setError(failure.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <label htmlFor="bill-name">Name</label>
      <input
        className="field"
        id="bill-name"
        name="name"
        defaultValue={bill?.name ?? ''}
        placeholder="Phone plan, rent, insurance…"
        maxLength={120}
        required
        autoFocus
      />
      <div className="form-grid">
        <div>
          <label htmlFor="bill-amount">Amount (leave empty if not known)</label>
          <input
            className="field"
            id="bill-amount"
            name="amount"
            inputMode="decimal"
            placeholder="TBC"
            defaultValue={
              bill?.amount_cents != null ? (bill.amount_cents / 100).toFixed(2) : ''
            }
          />
        </div>
        <div>
          <label htmlFor="bill-due">Due date</label>
          <input
            className="field"
            id="bill-due"
            name="due_date"
            type="date"
            defaultValue={bill?.due_date ?? `${month}-01`}
            required
          />
        </div>
      </div>
      <label htmlFor="bill-kind">Kind</label>
      <SelectField
        id="bill-kind"
        name="kind"
        defaultValue={bill?.kind ?? 'recurring'}
        options={BILL_KINDS.map((kind) => ({ value: kind, label: KIND_LABELS[kind] }))}
        placeholder="Choose a kind"
        required
      />
      <label htmlFor="bill-keywords">Match keywords (optional)</label>
      <input
        className="field"
        id="bill-keywords"
        name="keywords"
        defaultValue={bill?.keywords?.join(', ') ?? ''}
        placeholder="Words in the merchant name, separated by commas"
      />
      <p className="field-help">
        When a saved spend has one of these words and the exact amount, the bill is ticked
        as paid for you.
      </p>
      <p className="error" role="alert">
        {error}
      </p>
      <button className="primary full" type="submit" disabled={saving}>
        {saving ? 'Saving…' : bill ? 'Save changes' : 'Save bill'}
      </button>
      {bill && (
        <button
          className="danger full"
          type="button"
          disabled={saving}
          onClick={onDelete}
        >
          Delete bill
        </button>
      )}
    </form>
  );
}
