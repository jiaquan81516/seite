import { useEffect, useMemo, useState } from 'react';
import { AccountMenu } from '../components/account/AccountMenu';
import { AppTabs } from '../components/AppTabs';
import { BillForm } from '../components/BillForm';
import { DeleteConfirmation } from '../components/DeleteConfirmation';
import { Modal } from '../components/Modal';
import { useCollection } from '../hooks/useCollection';
import { useOnline } from '../hooks/useOnline';
import { formatDate, today } from '../lib/dates';
import {
  autoTickBills,
  billStatus,
  billsInMonth,
  dueLabel,
  nextOccurrence,
  setBillPaid,
} from '../lib/finance';
import { billStorage } from '../lib/finance-storage';
import { formatMoney } from '../lib/money';
import { entryStorage } from '../lib/storage';

function monthLabel(month) {
  return formatDate(`${month}-01`, { month: 'long', year: 'numeric' });
}
function moveMonth(month, step) {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number - 1 + step, 1));
  return date.toISOString().slice(0, 7);
}

export default function BillsPage({ navigate, onSignOut }) {
  const { items, status, save, saveMany, remove } = useCollection(billStorage);
  const online = useOnline();
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');
  const [ticked, setTicked] = useState(false);

  // Once the bills are loaded, tick any that a saved spend already paid.
  useEffect(() => {
    if (status !== 'ready' || ticked) return;
    setTicked(true);
    entryStorage
      .load()
      .then((entries) => saveMany(autoTickBills(items, entries)))
      .catch(() => {});
  }, [status, ticked, items, saveMany]);

  const bills = useMemo(() => billsInMonth(items, month), [items, month]);
  const unpaid = bills.filter((bill) => !bill.paid);
  const dueTotal = unpaid.reduce((sum, bill) => sum + (bill.amount_cents ?? 0), 0);
  const tbc = unpaid.filter((bill) => bill.amount_cents == null).length;

  async function togglePaid(bill) {
    setError('');
    try {
      const paid = !bill.paid;
      await save(setBillPaid(bill, paid));
      if (paid && bill.kind !== 'one-off') {
        const next = nextOccurrence(bill);
        const exists = items.some(
          (item) => item.name === next.name && item.due_date === next.due_date,
        );
        if (!exists) await save(next);
      }
    } catch {
      setError('Could not update the bill. Nothing was changed.');
    }
  }
  async function handleSave(bill) {
    await save(bill);
    setMonth(bill.due_date.slice(0, 7));
    setModal(null);
  }
  async function handleDelete(id) {
    await remove(id);
    setModal(null);
  }
  return (
    <main className="wrap">
      <header className="topbar">
        <button
          className="brand brand-link"
          onClick={() => navigate('home')}
          aria-label="Seite home"
        >
          <i />
          seite
        </button>
        <div className="account">
          <span>{online ? 'On this device' : 'Offline · on this device'}</span>
          <AccountMenu navigate={navigate} onSignOut={onSignOut} />
        </div>
      </header>
      <AppTabs page="bills" navigate={navigate} />
      <div className="heading">
        <div>
          <h1>Upcoming bills</h1>
          <span className="muted">
            {unpaid.length === 0
              ? 'Nothing left to pay this month.'
              : `${formatMoney(dueTotal)} still to pay${tbc ? `, plus ${tbc} amount${tbc === 1 ? '' : 's'} to be confirmed` : ''}`}
          </span>
        </div>
        <button
          className="primary desktop-add"
          disabled={status !== 'ready'}
          onClick={() => setModal({ type: 'bill' })}
        >
          + Add a bill
        </button>
      </div>
      <div className="period bills-month">
        <button
          className="circle"
          aria-label="Previous month"
          onClick={() => setMonth(moveMonth(month, -1))}
        >
          ‹
        </button>
        <span>{monthLabel(month)}</span>
        <button
          className="circle"
          aria-label="Next month"
          onClick={() => setMonth(moveMonth(month, 1))}
        >
          ›
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {status === 'error' && (
        <p className="error" role="alert">
          Device storage is unavailable. Bills cannot be loaded.
        </p>
      )}
      <section className="panel bills-list" aria-label="Bills">
        {bills.length === 0 && status === 'ready' && (
          <div className="empty">
            <h2>No bills this month</h2>
            <p>Add rent, subscriptions or instalments to see when they are due.</p>
            <button className="outline" onClick={() => setModal({ type: 'bill' })}>
              Add a bill
            </button>
          </div>
        )}
        {bills.map((bill) => {
          const state = billStatus(bill);
          return (
            <div
              key={bill.id}
              className={`bill-row status-${state.replace(' ', '-').toLowerCase()}`}
            >
              <input
                type="checkbox"
                className="bill-check"
                checked={bill.paid}
                aria-label={`${bill.name} paid`}
                onChange={() => togglePaid(bill)}
              />
              <button
                className="bill-main"
                aria-label={`Edit ${bill.name}`}
                onClick={() => setModal({ type: 'bill', bill })}
              >
                <span className="row-title">{bill.name}</span>
                <span className="entry-meta">
                  <span className="chip">{bill.kind}</span>
                  <span className="when">{formatDate(bill.due_date)}</span>
                </span>
              </button>
              <span className={`bill-status ${state.replace(' ', '-').toLowerCase()}`}>
                {dueLabel(bill)}
              </span>
              <span className="row-amount">
                {bill.amount_cents == null
                  ? 'Amount TBC'
                  : formatMoney(bill.amount_cents)}
              </span>
            </div>
          );
        })}
      </section>
      <p className="local-note muted">
        Bills are ticked as paid when a saved spend has the same merchant words and exact
        amount. You can always tick or untick one yourself.
      </p>
      {modal?.type === 'bill' && (
        <Modal
          key={modal.bill?.id ?? 'new'}
          title={modal.bill ? 'Edit bill' : 'Add a bill'}
          onClose={() => setModal(null)}
        >
          <BillForm
            bill={modal.bill}
            month={month}
            onSave={handleSave}
            onDelete={() => setModal({ type: 'delete', bill: modal.bill })}
          />
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <Modal title="Delete this bill?" onClose={() => setModal(null)}>
          <DeleteConfirmation
            entry={{ id: modal.bill.id, merchant: modal.bill.name }}
            onDelete={handleDelete}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </main>
  );
}
