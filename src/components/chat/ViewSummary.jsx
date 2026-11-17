import { useId, useState } from 'react';
import { filterEntries, sortEntries } from '../../lib/transactions';
import { formatMoney, totalAmount } from '../../lib/money';
import { formatDate, periodLabel } from '../../lib/dates';
import { redactSensitiveText } from '../../../shared/privacy';

const SHOWN = 6;

// A short in-chat summary of the entries behind an answer, so the user never
// has to leave the conversation to see them.
export function ViewSummary({ view, entries }) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const matching = sortEntries(filterEntries(entries, view));
  const spent = matching.filter((entry) => !entry.refunded);
  const byCategory = new Map();
  for (const entry of spent)
    byCategory.set(
      entry.category,
      (byCategory.get(entry.category) || 0) + entry.amount_cents,
    );
  const categories = [...byCategory].sort((a, b) => b[1] - a[1]);
  return (
    <div className="view-summary">
      <button
        type="button"
        className="outline message-view"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? 'Hide entries ↑' : 'View these entries ↓'}
      </button>
      {open && (
        <div id={panel} className="view-summary-panel">
          <p className="view-summary-heading">
            <strong>{periodLabel(view.date, view.period)}</strong>
            <span>
              {spent.length} {spent.length === 1 ? 'entry' : 'entries'} ·{' '}
              {formatMoney(totalAmount(spent))}
            </span>
          </p>
          {!matching.length && <p className="field-help">No saved entries here.</p>}
          {categories.length > 1 && (
            <p className="view-summary-categories">
              {categories
                .slice(0, 3)
                .map(([name, cents]) => `${name} ${formatMoney(cents)}`)
                .join(' · ')}
            </p>
          )}
          <ul>
            {matching.slice(0, SHOWN).map((entry) => (
              <li key={entry.id}>
                <span>
                  <strong>{redactSensitiveText(entry.merchant)}</strong>
                  <small>
                    {formatDate(entry.date)} · {entry.category}
                    {entry.refunded ? ' · refunded' : ''}
                  </small>
                </span>
                <span>{formatMoney(entry.amount_cents)}</span>
              </li>
            ))}
          </ul>
          {matching.length > SHOWN && (
            <p className="field-help">
              and {matching.length - SHOWN} more. Open the Tracker to see them all.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
