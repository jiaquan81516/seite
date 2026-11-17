import { CATEGORIES, categoryColor } from '../lib/config';
import { formatMoney, totalAmount } from '../lib/money';
import { filterEntries } from '../lib/transactions';
const CIRCUMFERENCE = 2 * Math.PI * 54;
export function CategoryChart({ entries, filters, onSelect }) {
  const visible = filterEntries(entries, filters, { ignoreCategory: true });
  const total = totalAmount(visible);
  let offset = 0;
  const segments = CATEGORIES.map((category) => ({
    category,
    amount: totalAmount(visible.filter((entry) => entry.category === category)),
  }))
    .filter((group) => group.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((group) => {
      const length = (group.amount / total) * CIRCUMFERENCE;
      const segment = { ...group, length, offset };
      offset += length;
      return segment;
    });
  const centerTotal = formatMoney(totalAmount(filterEntries(entries, filters)));
  function toggleCategory(category) {
    onSelect(filters.category === category ? '' : category);
  }
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Where it went</h2>
        <span className="muted">Tap to filter</span>
      </div>
      <div className="breakdown">
        <div className="donut">
          <svg viewBox="0 0 140 140" aria-label="Spending by category">
            <circle
              cx="70"
              cy="70"
              r="54"
              fill="none"
              stroke="#fff2e6"
              strokeWidth="21"
            />
            {segments.map(({ category, amount, length, offset }) => (
              <circle
                key={category}
                className="segment"
                cx="70"
                cy="70"
                r="54"
                fill="none"
                stroke={categoryColor(category)}
                strokeWidth="21"
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={-offset}
                opacity={filters.category && filters.category !== category ? 0.25 : 1}
                role="button"
                tabIndex={0}
                aria-label={`Filter ${category}: ${formatMoney(amount)}`}
                aria-pressed={filters.category === category}
                onClick={() => toggleCategory(category)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleCategory(category);
                  }
                }}
              >
                <title>
                  {category}: {formatMoney(amount)}
                </title>
              </circle>
            ))}
          </svg>
          <div className="donut-center">
            <span>{filters.category || 'TOTAL SPENDING'}</span>
            <strong style={{ '--chars': centerTotal.length }}>{centerTotal}</strong>
            <span>{segments.length} categories</span>
          </div>
        </div>
        <div className="legend">
          {segments.map(({ category, amount }) => (
            <button
              key={category}
              className={`legend-row ${filters.category === category ? 'selected' : ''}`}
              onClick={() => toggleCategory(category)}
              aria-pressed={filters.category === category}
            >
              <i style={{ background: categoryColor(category) }} />
              <span>{category}</span>
              <strong>{formatMoney(amount)}</strong>
            </button>
          ))}
          {segments.length === 0 && (
            <p className="muted">Your category breakdown will appear here.</p>
          )}
        </div>
      </div>
    </section>
  );
}
