import { SelectField } from '../SelectField';
import { TimeField } from '../TimeField';
import { RefundReview } from './RefundReview';
import { CATEGORIES, PAYMENT_METHODS } from '../../lib/config';
import { formatMoney, parseAmount } from '../../lib/money';
import { formatDate } from '../../lib/dates';
export function CandidateCard({
  candidate,
  entries,
  onRefund,
  draft,
  onChange,
  duplicate,
  quote,
  retryRates,
  busy,
}) {
  const prefix = `candidate-${candidate.id}`;
  const disabled = busy || candidate.saved;
  const foreign = draft.currency && draft.currency !== 'SGD';
  let convertedAmount = null;
  try {
    if (quote?.rate) convertedAmount = Math.round(parseAmount(draft.amount) * quote.rate);
  } catch {
    /* Incomplete amount is reviewed before saving. */
  }
  if (candidate.kind !== 'expense')
    return (
      <article className="candidate-card excluded-candidate">
        <span className="preview-label">{candidate.kind}</span>
        <h3>{candidate.merchant || 'Unclear transaction'}</h3>
        <p>
          {candidate.notes ||
            'This is not an outgoing expense and won’t be added to spending.'}
        </p>
        <p className="field-help">
          Refunds and transfers aren’t logged as spends. Income and PayLater tracking
          arrive in their own milestones.
        </p>
        {candidate.kind === 'refund' && (
          <RefundReview
            candidate={candidate}
            entries={entries}
            onRefund={onRefund}
            disabled={busy}
          />
        )}
      </article>
    );
  if (candidate.saved) {
    const saved = entries.find((entry) => entry.id === candidate.id);
    return (
      <article className="candidate-card candidate-saved saved-entry-summary">
        <strong>{saved ? '✓ Saved' : 'Removed from tracker'}</strong>
        <p>
          {saved?.merchant || candidate.merchant}{' '}
          {saved && (
            <>
              · {formatMoney(saved.amount_cents)} · {formatDate(saved.date)}
            </>
          )}
        </p>
        {saved && (
          <small>
            {saved.category} · {saved.method}
            {saved.refunded ? ' · Refunded' : ''}
          </small>
        )}
      </article>
    );
  }
  return (
    <article className={`candidate-card ${candidate.saved ? 'candidate-saved' : ''}`}>
      <label className="candidate-select">
        <input
          type="checkbox"
          checked={draft.selected}
          disabled={disabled}
          onChange={(event) => onChange('selected', event.target.checked)}
        />
        <strong>{candidate.saved ? '✓ Saved' : 'Add this spend'}</strong>
        <span>{Math.round(candidate.confidence * 100)}% confidence</span>
      </label>
      {candidate.confidence < 0.7 && (
        <p className="candidate-warning">
          Some details were unclear. Check the fields before saving.
        </p>
      )}
      <div className="candidate-fields">
        <div>
          <label htmlFor={`${prefix}-merchant`}>Merchant</label>
          <input
            className="field"
            id={`${prefix}-merchant`}
            value={draft.merchant}
            maxLength={160}
            disabled={disabled}
            onChange={(event) => onChange('merchant', event.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-amount`}>
            {candidate.needs_personal_share ? 'Your own share' : 'Amount'}
          </label>
          <input
            className="field"
            id={`${prefix}-amount`}
            inputMode="decimal"
            value={draft.amount}
            disabled={disabled}
            onChange={(event) => onChange('amount', event.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-currency`}>Currency</label>
          <input
            className="field"
            id={`${prefix}-currency`}
            maxLength={3}
            placeholder="SGD"
            value={draft.currency}
            disabled={disabled}
            onChange={(event) => onChange('currency', event.target.value.toUpperCase())}
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-date`}>Transaction date</label>
          <input
            className="field"
            id={`${prefix}-date`}
            type="date"
            value={draft.date}
            disabled={disabled}
            onChange={(event) => onChange('date', event.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-time`}>Time (optional)</label>
          <TimeField
            id={`${prefix}-time`}
            value={draft.time}
            disabled={disabled}
            onChange={(next) => onChange('time', next)}
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-category`}>Category</label>
          <SelectField
            id={`${prefix}-category`}
            value={draft.category}
            disabled={disabled}
            onValueChange={(value) => onChange('category', value)}
            options={CATEGORIES}
            placeholder="Choose a category"
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-method`}>Payment method</label>
          <SelectField
            id={`${prefix}-method`}
            value={draft.method}
            disabled={disabled}
            onValueChange={(value) => onChange('method', value)}
            options={PAYMENT_METHODS}
            placeholder="Choose a method"
          />
        </div>
      </div>
      {candidate.notes && <p className="field-help">{candidate.notes}</p>}
      {foreign && (
        <p className="candidate-fx">
          {quote?.rate
            ? `Converted: ${convertedAmount === null ? '—' : formatMoney(convertedAmount)} · 1 ${draft.currency} = S$${quote.rate} · reference rate as of ${quote.date}`
            : quote?.error || 'Checking the latest reference rate…'}
          {(quote?.error || quote?.rate) && (
            <button className="plain-link" onClick={retryRates}>
              Refresh rate
            </button>
          )}
        </p>
      )}
      {duplicate && (
        <div className="candidate-warning">
          This looks like {duplicate.merchant} {formatMoney(duplicate.amount_cents)} you
          already have on {duplicate.date}.
          <label className="chat-check">
            <input
              type="checkbox"
              checked={draft.allowDuplicate}
              disabled={disabled}
              onChange={(event) => onChange('allowDuplicate', event.target.checked)}
            />
            Add anyway (default: No)
          </label>
        </div>
      )}
      {candidate.needs_personal_share && (
        <label className="chat-check">
          <input
            type="checkbox"
            checked={draft.shareConfirmed}
            disabled={disabled}
            onChange={(event) => onChange('shareConfirmed', event.target.checked)}
          />
          This amount is my own share, not the group total.
        </label>
      )}
      {candidate.confidence < 0.7 && (
        <label className="chat-check">
          <input
            type="checkbox"
            checked={draft.reviewConfirmed}
            disabled={disabled}
            onChange={(event) => onChange('reviewConfirmed', event.target.checked)}
          />
          I checked and corrected the unclear details.
        </label>
      )}
    </article>
  );
}
