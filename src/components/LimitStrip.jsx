import { periodRange } from '../lib/dates';
import { limitStatus, loadPlan } from '../lib/finance';
import { formatMoney, totalAmount } from '../lib/money';

const NAMES = { Day: 'today', Week: 'this week', Month: 'this month' };

// A slim reminder of the spending limit set on the Plan page for this period.
export function LimitStrip({ entries, period, date, onOpen }) {
  const limit = loadPlan()[period];
  if (!limit) return null;
  const [start, end] = periodRange(date, period);
  const spent = totalAmount(
    entries.filter((entry) => entry.date >= start && entry.date <= end),
  );
  const status = limitStatus(spent, limit);
  return (
    <button
      className={`limit-strip ${status.state}`}
      onClick={onOpen}
      aria-label={`Spending limit ${NAMES[period]}`}
    >
      <span>
        {status.remaining >= 0
          ? `${formatMoney(status.remaining)} left ${NAMES[period]}`
          : `${formatMoney(-status.remaining)} over ${NAMES[period]}`}
      </span>
      <span className="progress" aria-hidden="true">
        <i style={{ width: `${Math.min(100, status.percent)}%` }} />
      </span>
      <span className="muted">
        {formatMoney(spent)} of {formatMoney(limit)}
      </span>
    </button>
  );
}
