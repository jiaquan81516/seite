import { useAccount } from '../account/AccountProvider';
import { AccountMenu } from '../components/account/AccountMenu';
import { useEffect, useState } from 'react';
import { CategoryChart } from '../components/CategoryChart';
import { DayChart } from '../components/DayChart';
import { DeleteConfirmation } from '../components/DeleteConfirmation';
import { EntryForm } from '../components/EntryForm';
import { EntryList } from '../components/EntryList';
import { Modal } from '../components/Modal';
import { SpendingTotal } from '../components/SpendingTotal';
import { DayContext } from '../components/DayContext';
import { TrackerControls } from '../components/TrackerControls';
import { TrackerNavigation } from '../components/TrackerNavigation';
import { useEntries } from '../hooks/useEntries';
import { useOnline } from '../hooks/useOnline';
import { today } from '../lib/dates';
import { AppTabs } from '../components/AppTabs';
import { IncomeView } from '../components/IncomeView';
import { LimitStrip } from '../components/LimitStrip';
import { InsightView } from '../components/InsightView';
import { getPrototype, setPrototype } from '../lib/prototype';
import { filterEntries } from '../lib/transactions';
import { periodRange } from '../lib/dates';
import { totalAmount } from '../lib/money';
const EMPTY_FILTERS = {
  category: '',
  method: '',
  search: '',
  day: '',
  excludeSensitive: false,
};
export default function TrackerPage({ onHome, navigate, onSignOut, initialView }) {
  const { entries, status, saveEntry, deleteEntry } = useEntries();
  const { preferences } = useAccount();
  const online = useOnline();
  const [filters, setFilters] = useState(() => ({
    ...EMPTY_FILTERS,
    date: today(),
    period: preferences.defaultPeriod,
    ...initialView,
  }));
  const [prototype, setPrototypeState] = useState(getPrototype);
  const [view, setView] = useState('Expenses');
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');
  const visibleEntries = filterEntries(entries, filters);
  const [periodStart, periodEnd] = periodRange(filters.date, filters.period);
  const periodSpent = totalAmount(
    entries.filter((entry) => entry.date >= periodStart && entry.date <= periodEnd),
  );
  const filtered = Boolean(
    filters.category ||
    filters.method ||
    filters.search ||
    filters.day ||
    filters.excludeSensitive,
  );
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timeout);
  }, [notice]);
  function changeFilters(changes) {
    setFilters((current) => ({ ...current, ...changes }));
  }
  function clearFilters() {
    changeFilters(EMPTY_FILTERS);
  }
  function closeModal() {
    setModal(null);
  }
  function addEntry() {
    if (status !== 'ready') {
      setNotice('Storage is unavailable. Reload after enabling browser storage.');
      return;
    }
    setModal({ type: 'entry' });
  }
  async function handleSave(entry) {
    await saveEntry(entry);
    changeFilters({ ...EMPTY_FILTERS, date: entry.date });
    closeModal();
    setNotice(modal.entry ? 'Changes saved' : 'Spend saved');
  }
  async function handleDelete(id) {
    await deleteEntry(id);
    closeModal();
    setNotice('Spend deleted');
  }
  const timeChart =
    filters.period === 'Day' ? (
      <DayContext
        entries={entries}
        date={filters.date}
        onSelect={(date) => changeFilters({ date, day: '' })}
      />
    ) : (
      <DayChart
        entries={entries}
        filters={filters}
        onSelect={(day) => changeFilters({ day })}
      />
    );
  if (status === 'loading')
    return (
      <p className="loading" role="status">
        Opening your tracker…
      </p>
    );
  return (
    <main className="wrap" data-prototype={prototype}>
      <header className="topbar">
        <button className="brand brand-link" onClick={onHome} aria-label="Seite home">
          <i />
          seite
        </button>
        <div className="account">
          <span>{online ? 'On this device' : 'Offline · on this device'}</span>
          <AccountMenu navigate={navigate} onSignOut={onSignOut} />
        </div>
      </header>
      <AppTabs page="tracker" navigate={navigate} />
      <div className="prototype-pill">
        <span>Layout</span>
        <div className="seg" role="group" aria-label="Prototype">
          {['A', 'B'].map((value) => (
            <button
              key={value}
              className={prototype === value ? 'active' : ''}
              aria-pressed={prototype === value}
              onClick={() => setPrototypeState(setPrototype(value))}
            >
              Prototype {value}
            </button>
          ))}
        </div>
      </div>
      <div className="heading">
        <div>
          <h1>Your money, at a glance.</h1>
        </div>
        <button className="primary desktop-add" onClick={addEntry}>
          + Add a spend
        </button>
      </div>
      {status === 'error' && (
        <p className="error" role="alert">
          Device storage is unavailable. Entries cannot be saved. Check your browser
          storage permissions and reload.
        </p>
      )}
      <div className="seg view-toggle" role="group" aria-label="View">
        {['Expenses', 'Income'].map((value) => (
          <button
            key={value}
            className={view === value ? 'active' : ''}
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <TrackerControls
        filters={filters}
        onChange={changeFilters}
        onToday={() => changeFilters({ ...EMPTY_FILTERS, date: today(), period: 'Day' })}
        onClear={clearFilters}
      />
      {view === 'Income' ? (
        <IncomeView filters={filters} spent={periodSpent} />
      ) : (
        <>
          <LimitStrip
            entries={entries}
            period={filters.period}
            date={filters.date}
            onOpen={() => navigate('plan')}
          />
          {prototype === 'B' ? (
            <InsightView
              entries={visibleEntries}
              allEntries={entries}
              filters={filters}
              onSelect={(category) => changeFilters({ category })}
              trend={timeChart}
            />
          ) : (
            <>
              <SpendingTotal entries={visibleEntries} filters={filters} />
              <div className="grid">
                {timeChart}
                <CategoryChart
                  entries={entries}
                  filters={filters}
                  onSelect={(category) => changeFilters({ category })}
                />
              </div>
            </>
          )}
          <EntryList
            entries={visibleEntries}
            day={filters.day}
            grouped={prototype === 'B'}
            filtered={filtered}
            onAdd={addEntry}
            onEdit={(entry) => setModal({ type: 'entry', entry })}
            onClear={clearFilters}
          />
        </>
      )}
      <p className="local-note muted">
        Saved on this device · SGD ·{' '}
        {status === 'error'
          ? 'Storage unavailable'
          : 'Works offline after your first visit'}
      </p>
      <TrackerNavigation onAdd={addEntry} onChat={() => navigate('chat')} />
      <div id="toast" className={notice ? 'show' : ''} role="status" aria-live="polite">
        {notice}
      </div>
      {modal?.type === 'entry' && (
        <Modal
          key={modal.entry?.id ?? 'new'}
          title={modal.entry ? 'Edit spend' : 'Add a spend'}
          onClose={closeModal}
        >
          <EntryForm
            entry={modal.entry}
            date={filters.day || filters.date}
            defaultMethod={preferences.defaultMethod}
            onSave={handleSave}
            onDelete={() => setModal({ type: 'delete', entry: modal.entry })}
          />
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <Modal title="Delete this spend?" onClose={closeModal}>
          <DeleteConfirmation
            entry={modal.entry}
            onDelete={handleDelete}
            onCancel={closeModal}
          />
        </Modal>
      )}
    </main>
  );
}
