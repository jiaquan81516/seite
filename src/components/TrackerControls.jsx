import { SelectField } from './SelectField';
import { CATEGORIES, PAYMENT_METHODS } from '../lib/config';
import { isValidDate, movePeriod, periodLabel } from '../lib/dates';
export function TrackerControls({ filters, onChange, onToday, onClear }) {
  const { date, period, search, category, method } = filters;
  const hasFilters =
    search || category || method || filters.day || filters.excludeSensitive;
  return (
    <>
      <div className="toolbar">
        <div className="seg" aria-label="Time period">
          {['Day', 'Week', 'Month'].map((value) => (
            <button
              key={value}
              className={period === value ? 'active' : ''}
              aria-pressed={period === value}
              onClick={() => onChange({ period: value, day: '' })}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="period">
          <button
            className="circle"
            aria-label="Previous period"
            onClick={() => onChange({ date: movePeriod(date, period, -1), day: '' })}
          >
            ‹
          </button>
          <span>{periodLabel(date, period)}</span>
          <button
            className="circle"
            aria-label="Next period"
            onClick={() => onChange({ date: movePeriod(date, period, 1), day: '' })}
          >
            ›
          </button>
        </div>
      </div>
      <div className="filters">
        <label>
          Merchant
          <input
            className="field"
            type="search"
            placeholder="Search merchants…"
            value={search}
            onChange={(event) => onChange({ search: event.target.value })}
          />
        </label>
        <label>
          Category
          <SelectField
            value={category}
            onValueChange={(value) => onChange({ category: value })}
            options={CATEGORIES}
            placeholder="All categories"
          />
        </label>
        <label>
          Payment method
          <SelectField
            value={method}
            onValueChange={(value) => onChange({ method: value })}
            options={PAYMENT_METHODS}
            placeholder="All methods"
          />
        </label>
        <label>
          Date
          <input
            className="field"
            type="date"
            value={date}
            onChange={(event) => {
              if (isValidDate(event.target.value))
                onChange({ date: event.target.value, period: 'Day', day: '' });
            }}
            required
          />
        </label>
        <button className="text-btn" onClick={onToday}>
          Today
        </button>
        {hasFilters && (
          <button className="text-btn" onClick={onClear}>
            Clear filters ×
          </button>
        )}
      </div>
      {filters.excludeSensitive && (
        <p className="field-help">
          Cloud-shared entries only. Clear filters to include local-only entries.
        </p>
      )}
    </>
  );
}
