import { useState } from 'react';
import { DeleteConfirmation } from './DeleteConfirmation';
import { IncomeForm } from './IncomeForm';
import { Modal } from './Modal';
import { useCollection } from '../hooks/useCollection';
import { formatDate, periodLabel } from '../lib/dates';
import { filterIncome, incomeBySource, sortIncome, totalIncome } from '../lib/finance';
import { incomeStorage } from '../lib/finance-storage';
import { formatMoney } from '../lib/money';

// "Money in" for the selected period, kept apart from spending totals.
export function IncomeView({ filters, spent }) {
  const { items, status, save, remove } = useCollection(incomeStorage);
  const [modal, setModal] = useState(null);
  const visible = sortIncome(filterIncome(items, filters));
  const total = totalIncome(visible);
  const balance = total - spent;
  const sources = incomeBySource(visible);
  const max = sources[0]?.amount || 1;
  async function handleSave(item) {
    await save(item);
    setModal(null);
  }
  async function handleDelete(id) {
    await remove(id);
    setModal(null);
  }
  return (
    <section className="income-view" aria-label="Income">
      <div className="balance-card">
        <div>
          <span className="eyebrow">{periodLabel(filters.date, filters.period)}</span>
          <div className="balance-amount" aria-label="Balance">
            {formatMoney(balance)}
          </div>
          <span className="muted">
            {balance >= 0 ? 'Saved' : 'Overspent'} after spending
          </span>
        </div>
        <dl className="balance-parts">
          <div>
            <dt>Money in</dt>
            <dd className="in">{formatMoney(total)}</dd>
          </div>
          <div>
            <dt>Money out</dt>
            <dd className="out">{formatMoney(spent)}</dd>
          </div>
        </dl>
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>Where it came from</h2>
        </div>
        {sources.length === 0 && <p className="muted">No income in this period.</p>}
        <ol className="rank-list">
          {sources.map(({ source, amount }) => (
            <li key={source}>
              <div className="rank-row">
                <span className="rank-name">{source}</span>
                <span className="rank-bar">
                  <i
                    style={{
                      width: `${Math.max(4, (amount / max) * 100)}%`,
                      background: '#1caf77',
                    }}
                  />
                </span>
                <span className="rank-value">{formatMoney(amount)}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <section className="panel transactions" aria-label="Your income">
        <div className="panel-head">
          <h2>
            Your income <span className="muted">· {visible.length}</span>
          </h2>
          <button
            className="text-btn"
            disabled={status !== 'ready'}
            onClick={() => setModal({ type: 'income' })}
          >
            + Add income
          </button>
        </div>
        {visible.map((item) => (
          <button
            key={item.id}
            className="row entry-row income-row"
            style={{ '--c': '#1caf77' }}
            aria-label={`Edit ${item.source}, ${formatMoney(item.amount_cents)}`}
            onClick={() => setModal({ type: 'income', income: item })}
          >
            <span className="badge" style={{ '--c': '#1caf77' }}>
              +
            </span>
            <span className="entry-info">
              <span className="row-title">{item.source}</span>
              <span className="entry-meta">
                <span className="when">{formatDate(item.date)}</span>
                {item.note && <span className="chip">{item.note}</span>}
              </span>
            </span>
            <span className="row-amount in">+{formatMoney(item.amount_cents)}</span>
          </button>
        ))}
        {visible.length === 0 && (
          <div className="empty">
            <h2>No income here yet</h2>
            <p>Add money in to see your balance for this period.</p>
            <button className="outline" onClick={() => setModal({ type: 'income' })}>
              Add income
            </button>
          </div>
        )}
      </section>
      {modal?.type === 'income' && (
        <Modal
          key={modal.income?.id ?? 'new'}
          title={modal.income ? 'Edit income' : 'Add income'}
          onClose={() => setModal(null)}
        >
          <IncomeForm
            income={modal.income}
            date={filters.date}
            onSave={handleSave}
            onDelete={() => setModal({ type: 'delete', income: modal.income })}
          />
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <Modal title="Delete this income?" onClose={() => setModal(null)}>
          <DeleteConfirmation
            entry={{ id: modal.income.id, merchant: modal.income.source }}
            onDelete={handleDelete}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </section>
  );
}
