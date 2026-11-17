import { formatDate, shiftDays } from '../lib/dates';
import { formatMoney, totalAmount } from '../lib/money';

// For a single day, a lone bar says nothing. This puts the day beside the week
// before it so you can see at a glance whether it was a normal one.
export function dayContext(entries, date) {
  const totalOn = (day) => totalAmount(entries.filter((entry) => entry.date === day));
  const days = Array.from({ length: 7 }, (_, index) => shiftDays(date, index - 6));
  const totals = days.map(totalOn);
  const before = Array.from({ length: 7 }, (_, index) =>
    totalOn(shiftDays(date, -7 + index)),
  );
  const average = Math.round(before.reduce((sum, value) => sum + value, 0) / 7);
  const today = totals[6];
  const biggest = entries
    .filter((entry) => entry.date === date && !entry.refunded)
    .sort((a, b) => b.amount_cents - a.amount_cents)[0];
  let verdict = 'none';
  if (average > 0) {
    const ratio = today / average;
    verdict = ratio > 1.1 ? 'above' : ratio < 0.9 ? 'below' : 'same';
  }
  return { days, totals, average, today, biggest, verdict };
}

export function DayContext({ entries, date, onSelect }) {
  const info = dayContext(entries, date);
  const maximum = Math.max(...info.totals, 1);
  const difference = Math.abs(info.today - info.average);
  let headline = 'Not enough earlier days to compare yet.';
  if (info.verdict === 'above')
    headline = `${formatMoney(difference)} more than your usual day`;
  if (info.verdict === 'below')
    headline = `${formatMoney(difference)} less than your usual day`;
  if (info.verdict === 'same') headline = 'About the same as your usual day';
  return (
    <section className="panel day-context" aria-label="Compared with the past week">
      <div className="panel-head">
        <h2>Compared with your week</h2>
        <span className="muted">Last 7 days</span>
      </div>
      <p className={`context-headline ${info.verdict}`}>{headline}</p>
      <p className="muted context-sub">
        {info.average > 0
          ? `Your usual day over the 7 days before is ${formatMoney(info.average)}.`
          : 'Add a few more days of spending to see a usual day.'}
      </p>
      <div className="bars">
        {info.days.map((day, index) => (
          <button
            key={day}
            className={`bar-item ${day === date ? 'selected' : ''}`}
            aria-pressed={day === date}
            aria-label={`${formatDate(day)}: ${formatMoney(info.totals[index])}`}
            onClick={() => onSelect(day)}
          >
            <small className="bar-amount">
              {info.totals[index] ? formatMoney(info.totals[index]) : ''}
            </small>
            <i
              className="bar"
              style={{
                height: Math.max(3, (info.totals[index] / maximum) * 100),
                opacity: day === date ? 1 : 0.4,
              }}
            />
            <span>{formatDate(day, { weekday: 'short' })}</span>
          </button>
        ))}
      </div>
      {info.biggest && (
        <p className="context-biggest">
          Biggest spend: <strong>{info.biggest.merchant}</strong>{' '}
          {formatMoney(info.biggest.amount_cents)}
        </p>
      )}
    </section>
  );
}
