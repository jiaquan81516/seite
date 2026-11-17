import { normalizeTime } from '../../lib/dates';
import { useEffect, useRef, useState } from 'react';
import { PAYMENT_METHODS } from '../../lib/config';
import { parseAmount } from '../../lib/money';
import { candidateToEntry, duplicateFor } from '../../chat/review';
import { merchantKey } from '../../chat/storage';
import { useExchangeRates } from '../../chat/useExchangeRates';
import { CandidateCard } from './CandidateCard';

function initialDraft(candidate, entries) {
  const duplicate =
    candidate.currency === 'SGD' &&
    candidate.amount !== null &&
    duplicateFor(entries, candidate.date, Math.round(candidate.amount * 100));
  return {
    merchant: candidate.merchant || '',
    amount: candidate.amount === null ? '' : String(candidate.amount),
    currency: candidate.currency || '',
    date: candidate.date || '',
    time: normalizeTime(candidate.time),
    category: candidate.category || '',
    method: PAYMENT_METHODS.includes(candidate.payment_method)
      ? candidate.payment_method
      : '',
    selected: candidate.selected && !duplicate && !candidate.saved,
    allowDuplicate: false,
    shareConfirmed: false,
    reviewConfirmed: false,
  };
}
function homeCents(draft, quote) {
  try {
    const amount = parseAmount(draft.amount);
    return draft.currency === 'SGD'
      ? amount
      : quote?.rate
        ? Math.round(amount * quote.rate)
        : null;
  } catch {
    return null;
  }
}
export function ReviewBatch({
  message,
  entries,
  onSave,
  onRefund,
  onCancel,
  disabled = false,
}) {
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      message.candidates.map((candidate) => [
        candidate.id,
        initialDraft(candidate, entries),
      ]),
    ),
  );
  const previousCategories = useRef(
    new Map(message.candidates.map((candidate) => [candidate.id, candidate.category])),
  );
  useEffect(() => {
    const changed = message.candidates.filter(
      (candidate) => previousCategories.current.get(candidate.id) !== candidate.category,
    );
    if (changed.length)
      setDrafts((current) => {
        const next = { ...current };
        for (const candidate of changed)
          next[candidate.id] = {
            ...next[candidate.id],
            category: candidate.category || '',
          };
        return next;
      });
    previousCategories.current = new Map(
      message.candidates.map((candidate) => [candidate.id, candidate.category]),
    );
  }, [message.candidates]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { quotes, retryRates } = useExchangeRates(
    Object.values(drafts).map((draft) => draft.currency),
  );
  function change(id, field, value) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
    setError('');
  }
  function duplicate(candidate) {
    const draft = drafts[candidate.id];
    const amount = homeCents(draft, quotes[draft.currency]);
    const saved = duplicateFor(entries, draft.date, amount);
    if (saved && saved.external_ref !== `ai-chat-${message.id}-${candidate.id}`)
      return saved;
    const other = message.candidates.find(
      (item) =>
        item.id !== candidate.id &&
        !item.saved &&
        drafts[item.id].selected &&
        drafts[item.id].date === draft.date &&
        homeCents(drafts[item.id], quotes[drafts[item.id].currency]) === amount &&
        amount !== null,
    );
    return other
      ? {
          merchant: drafts[other.id].merchant || 'another selected item',
          date: draft.date,
          amount_cents: amount,
        }
      : null;
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const selected = message.candidates.filter(
        (candidate) =>
          drafts[candidate.id].selected &&
          !candidate.saved &&
          candidate.kind === 'expense',
      );
      const records = selected.map((candidate) => {
        const draft = drafts[candidate.id];
        if (duplicate(candidate) && !draft.allowDuplicate)
          throw new Error(
            'A selected item looks like a duplicate. Unselect it or explicitly choose Add anyway.',
          );
        return candidateToEntry(candidate, message.id, draft, quotes[draft.currency]);
      });
      const rules = selected
        .filter((candidate) => drafts[candidate.id].category !== candidate.category)
        .map((candidate) => ({
          merchant: merchantKey(drafts[candidate.id].merchant),
          category: drafts[candidate.id].category,
        }));
      await onSave(
        message.id,
        records,
        selected
          .filter((candidate) => drafts[candidate.id].allowDuplicate)
          .map((candidate) => candidate.id),
        rules,
      );
    } catch (error) {
      setError(error.message || 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    setError('');
    try {
      await onCancel(message.id);
    } catch (error) {
      setError(error.message || 'Could not cancel this review. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  const count = message.candidates.filter(
    (candidate) =>
      drafts[candidate.id].selected && !candidate.saved && candidate.kind === 'expense',
  ).length;
  const allSaved = message.candidates
    .filter((candidate) => candidate.kind === 'expense')
    .every((candidate) => candidate.saved);
  return (
    <div className="review-batch">
      {message.candidates.map((candidate) => (
        <CandidateCard
          key={candidate.id}
          candidate={candidate}
          entries={entries}
          onRefund={(originalId) => onRefund(message.id, candidate.id, originalId)}
          draft={drafts[candidate.id]}
          onChange={(field, value) => change(candidate.id, field, value)}
          duplicate={duplicate(candidate)}
          quote={quotes[drafts[candidate.id].currency]}
          retryRates={retryRates}
          busy={busy || disabled}
        />
      ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="review-actions">
        {!allSaved && (
          <button
            className="primary"
            disabled={busy || disabled || count === 0}
            onClick={save}
          >
            {busy ? 'Saving…' : `Save selected (${count})`}
          </button>
        )}
        {message.candidates.some((candidate) => !candidate.saved) && (
          <button
            type="button"
            className="outline"
            disabled={busy || disabled}
            onClick={cancel}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
