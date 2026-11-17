import { formatDate, today } from '../lib/dates';
import { formatMoney, totalAmount } from '../lib/money';
export function SpendingTotal({ entries, filters }) {
  let heading;
  if (filters.day) heading = `Spent on ${formatDate(filters.day)}`;
  else if (filters.period === 'Day')
    heading =
      filters.date === today() ? 'Spent today' : `Spent on ${formatDate(filters.date)}`;
  else heading = filters.period === 'Week' ? 'Spent this week' : 'Spent this month';
  const filtered = filters.day || filters.category || filters.method || filters.search;
  return (
    <section className="hero" aria-label="Spending total">
      <div>
        <div className="eyebrow">{heading}</div>
        <div className="amount">{formatMoney(totalAmount(entries))}</div>
        <p>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          {filtered ? ' · filtered view' : ''}
        </p>
      </div>
    </section>
  );
}
