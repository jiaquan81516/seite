import { categoryColor } from '../lib/config';
import { formatDate } from '../lib/dates';
import { formatMoney, totalAmount } from '../lib/money';
import { sortEntries } from '../lib/transactions';
export function EntryList({
  entries,
  filtered,
  day,
  grouped = false,
  onEdit,
  onAdd,
  onClear,
}) {
  const sorted = sortEntries(entries);
  const groups = grouped
    ? [...new Set(sorted.map((entry) => entry.date))].map((date) => ({
        date,
        items: sorted.filter((entry) => entry.date === date),
      }))
    : [{ date: '', items: sorted }];
  return (
    <section className="panel transactions" aria-label="Your entries">
      <div className="panel-head">
        <h2>
          Your entries <span className="muted">· {entries.length}</span>
        </h2>
        <button className="text-btn" onClick={onAdd}>
          + Add a spend
        </button>
      </div>
      {day && <p className="muted">Showing {formatDate(day)}</p>}
      {groups.map((group) => (
        <div key={group.date || 'all'}>
          {grouped && (
            <div className="day-group-head">
              <span>{formatDate(group.date)}</span>
              <span>{formatMoney(totalAmount(group.items))}</span>
            </div>
          )}
          {group.items.map((entry) => (
            <button
              key={entry.id}
              className={`row entry-row ${entry.refunded ? 'refunded-entry' : ''}`}
              onClick={() => onEdit(entry)}
              style={{ '--c': categoryColor(entry.category) }}
              aria-label={`Edit ${entry.merchant}, ${formatMoney(entry.amount_cents)}`}
            >
              <span className="badge" style={{ '--c': categoryColor(entry.category) }}>
                {entry.category[0]}
              </span>
              <span className="entry-info">
                <span className="row-title">
                  {entry.merchant}
                  {entry.refunded && <em className="refund-tag">Refunded</em>}
                </span>
                <span className="entry-meta">
                  <span className="chip">{entry.category}</span>
                  <span className="chip method">{entry.method}</span>
                  <span className="when">
                    {grouped ? entry.time || 'No time' : formatDate(entry.date)}
                    {!grouped && entry.time ? ` · ${entry.time}` : ''}
                  </span>
                </span>
              </span>
              <span className="row-amount">{formatMoney(entry.amount_cents)}</span>
              <span className="edit-hint" aria-hidden="true">
                ↗
              </span>
            </button>
          ))}
        </div>
      ))}
      {entries.length === 0 && (
        <div className="empty">
          <div className="empty-mark">✧</div>
          <h2>{filtered ? 'No matching entries' : 'A fresh start.'}</h2>
          <p>
            {filtered
              ? 'Try changing your filters or date.'
              : 'Add your first spend. Your days will start to take shape here.'}
          </p>
          <button className="outline" onClick={filtered ? onClear : onAdd}>
            {filtered ? 'Clear filters' : 'Add a spend'}
          </button>
        </div>
      )}
    </section>
  );
}
