import { daysInPeriod, formatDate } from '../lib/dates';
import { formatMoney, totalAmount } from '../lib/money';
import { filterEntries } from '../lib/transactions';
export function DayChart({ entries, filters, onSelect }) {
  const days = daysInPeriod(filters.date, filters.period);
  const visible = filterEntries(entries, filters, { ignoreDay: true });
  const values = days.map((day) =>
    totalAmount(visible.filter((entry) => entry.date === day)),
  );
  const maximum = Math.max(...values, 1);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Day by day</h2>
        <span className="muted">{filters.period}</span>
      </div>
      <div className="bars">
        {days.map((day, index) => (
          <button
            key={day}
            className={`bar-item ${filters.day === day ? 'selected' : ''}`}
            onClick={() => onSelect(filters.day === day ? '' : day)}
            aria-pressed={filters.day === day}
            aria-label={`${formatDate(day)}: ${formatMoney(values[index])}`}
            data-tip={`${formatDate(day)} · ${formatMoney(values[index])}`}
          >
            <i
              className="bar"
              style={{
                height: Math.max(3, (values[index] / maximum) * 115),
                opacity: filters.day && filters.day !== day ? 0.25 : 1,
              }}
            />
            <span>
              {days.length < 8
                ? formatDate(day, { weekday: 'short' })
                : index % 5 === 0 || index === days.length - 1
                  ? Number(day.slice(8))
                  : ''}
            </span>
          </button>
        ))}
      </div>
      <p className="chart-note">Tap a day to filter your entries. Tap again to clear.</p>
    </section>
  );
}
