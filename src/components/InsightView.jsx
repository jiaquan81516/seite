import { CATEGORIES, categoryColor } from '../lib/config';
import { daysInPeriod, formatDate, today } from '../lib/dates';
import { formatMoney, totalAmount } from '../lib/money';
import { filterEntries } from '../lib/transactions';

// Prototype B: the answer first. Three headline numbers, then every category
// ranked as a bar, replacing the donut and day bars of Prototype A.
export function insightStats(entries, filters) {
  const total = totalAmount(entries);
  const days = daysInPeriod(filters.date, filters.period);
  const elapsed = days.filter((day) => day <= today()).length || days.length;
  const ranked = CATEGORIES.map((category) => ({
    category,
    amount: totalAmount(entries.filter((entry) => entry.category === category)),
  }))
    .filter((group) => group.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return {
    total,
    average: Math.round(total / (filters.period === 'Day' ? 1 : elapsed)),
    ranked,
  };
}

export function InsightView({ entries, allEntries, filters, onSelect, trend }) {
  const stats = insightStats(entries, filters);
  const visible = filterEntries(allEntries, filters, { ignoreCategory: true });
  const ranked = insightStats(visible, filters).ranked;
  const top = ranked[0];
  const max = top?.amount || 1;
  const sum = totalAmount(visible);
  const label = filters.day
    ? formatDate(filters.day)
    : { Day: 'today', Week: 'this week', Month: 'this month' }[filters.period];
  return (
    <section className="insight" aria-label="Spending insights">
      <div className="insight-tiles">
        <div className="insight-tile main">
          <span>Spent {label}</span>
          <strong>{formatMoney(stats.total)}</strong>
          <small>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </small>
        </div>
        <div className="insight-tile">
          <span>{filters.period === 'Day' ? 'Per entry' : 'Daily average'}</span>
          <strong>
            {formatMoney(
              filters.period === 'Day' && entries.length
                ? Math.round(stats.total / entries.length)
                : stats.average,
            )}
          </strong>
          <small>{filters.period === 'Day' ? 'average' : 'per day'}</small>
        </div>
        <div className="insight-tile">
          <span>Biggest category</span>
          <strong>{top ? top.category : '—'}</strong>
          <small>
            {top && sum
              ? `${Math.round((top.amount / sum) * 100)}% of spending`
              : 'No spending yet'}
          </small>
        </div>
      </div>
      <div className="insight-grid">
        <div className="panel">
          <div className="panel-head">
            <h2>Where it went</h2>
            <span className="muted">Tap a bar to filter</span>
          </div>
          {ranked.length === 0 && <p className="muted">Nothing to rank yet.</p>}
          <ol className="rank-list">
            {ranked.map(({ category, amount }) => (
              <li key={category}>
                <button
                  type="button"
                  aria-pressed={filters.category === category}
                  aria-label={`Filter ${category}: ${formatMoney(amount)}`}
                  className={
                    filters.category && filters.category !== category ? 'dim' : ''
                  }
                  onClick={() => onSelect(filters.category === category ? '' : category)}
                >
                  <span className="rank-name">{category}</span>
                  <span className="rank-bar">
                    <i
                      style={{
                        width: `${Math.max(4, (amount / max) * 100)}%`,
                        background: categoryColor(category),
                      }}
                    />
                  </span>
                  <span className="rank-value">
                    {formatMoney(amount)}{' '}
                    <small>{Math.round((amount / sum) * 100)}%</small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        {trend}
      </div>
    </section>
  );
}
