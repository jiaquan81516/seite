import { useEffect, useState } from 'react';
import { AccountMenu } from '../components/account/AccountMenu';
import { AppTabs } from '../components/AppTabs';
import { DeleteConfirmation } from '../components/DeleteConfirmation';
import { Modal } from '../components/Modal';
import { useCollection } from '../hooks/useCollection';
import { useOnline } from '../hooks/useOnline';
import { periodRange, today } from '../lib/dates';
import {
  LIMIT_PERIODS,
  addToGoal,
  createGoal,
  goalPercent,
  limitStatus,
  loadPlan,
  savePlan,
} from '../lib/finance';
import { goalStorage } from '../lib/finance-storage';
import { formatMoney, parseAmount, totalAmount } from '../lib/money';
import { entryStorage } from '../lib/storage';

const PERIOD_NAMES = { Day: 'Today', Week: 'This week', Month: 'This month' };

function spentIn(entries, period) {
  const [start, end] = periodRange(today(), period);
  return totalAmount(entries.filter((entry) => entry.date >= start && entry.date <= end));
}

function LimitRow({ period, limit, spent, onSave }) {
  const [value, setValue] = useState(limit ? (limit / 100).toFixed(2) : '');
  const [error, setError] = useState('');
  useEffect(() => setValue(limit ? (limit / 100).toFixed(2) : ''), [limit]);
  const status = limit ? limitStatus(spent, limit) : null;
  function submit(event) {
    event.preventDefault();
    setError('');
    try {
      onSave(period, value.trim() ? parseAmount(value) : null);
    } catch (failure) {
      setError(failure.message);
    }
  }
  return (
    <form className={`limit-row ${status?.state ?? ''}`} onSubmit={submit}>
      <div className="limit-head">
        <strong>{PERIOD_NAMES[period]}</strong>
        <span className="muted">
          {status
            ? status.remaining >= 0
              ? `${formatMoney(status.remaining)} left`
              : `${formatMoney(-status.remaining)} over`
            : 'No limit set'}
        </span>
      </div>
      {status && (
        <div
          className="progress"
          role="progressbar"
          aria-label={`${PERIOD_NAMES[period]} spending`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, status.percent)}
        >
          <i style={{ width: `${Math.min(100, status.percent)}%` }} />
        </div>
      )}
      <div className="limit-foot">
        <span>
          {formatMoney(spent)}
          {limit ? ` of ${formatMoney(limit)}` : ' spent'}
        </span>
        <span className="limit-input">
          <label htmlFor={`limit-${period}`} className="sr-only">
            {PERIOD_NAMES[period]} limit
          </label>
          <span>S$</span>
          <input
            id={`limit-${period}`}
            aria-label={`${PERIOD_NAMES[period]} limit (SGD)`}
            inputMode="decimal"
            placeholder="No limit"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <button className="text-btn" type="submit">
            Set
          </button>
        </span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function GoalCard({ goal, onSave, onDelete }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const percent = goalPercent(goal);
  async function add(event) {
    event.preventDefault();
    setError('');
    try {
      await onSave(addToGoal(goal, parseAmount(amount)));
      setAmount('');
    } catch (failure) {
      setError(failure.message || 'Could not save.');
    }
  }
  return (
    <article className="goal-card">
      <div className="limit-head">
        <strong>{goal.name}</strong>
        <span className="muted">{percent}%</span>
      </div>
      <div
        className="progress goal"
        role="progressbar"
        aria-label={`${goal.name} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <i style={{ width: `${percent}%` }} />
      </div>
      <div className="limit-foot">
        <span>
          {formatMoney(goal.saved_cents)} of {formatMoney(goal.target_cents)}
        </span>
        <form className="limit-input" onSubmit={add}>
          <label htmlFor={`add-${goal.id}`} className="sr-only">
            Add to {goal.name}
          </label>
          <span>S$</span>
          <input
            id={`add-${goal.id}`}
            aria-label={`Add to ${goal.name} (SGD)`}
            inputMode="decimal"
            placeholder="Add"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <button className="text-btn" type="submit">
            Add
          </button>
          <button
            className="text-btn"
            type="button"
            aria-label={`Delete ${goal.name}`}
            onClick={onDelete}
          >
            Delete
          </button>
        </form>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

function GoalForm({ onSave }) {
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await onSave(createGoal(fields));
    } catch (failure) {
      setError(failure.message || 'Could not save.');
    }
  }
  return (
    <form className="entry-form" onSubmit={submit}>
      <label htmlFor="goal-name">Goal</label>
      <input
        className="field"
        id="goal-name"
        name="name"
        placeholder="Japan trip, new laptop…"
        maxLength={80}
        required
        autoFocus
      />
      <label htmlFor="goal-target">Target amount (SGD)</label>
      <input
        className="field"
        id="goal-target"
        name="target"
        inputMode="decimal"
        placeholder="0.00"
        required
      />
      <p className="error" role="alert">
        {error}
      </p>
      <button className="primary full" type="submit">
        Save goal
      </button>
    </form>
  );
}

export default function PlanPage({ navigate, onSignOut }) {
  const online = useOnline();
  const goals = useCollection(goalStorage);
  const [entries, setEntries] = useState([]);
  const [limits, setLimits] = useState(loadPlan);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    entryStorage.load().then(setEntries, () => {});
  }, []);

  function saveLimit(period, cents) {
    const next = { ...limits, [period]: cents };
    try {
      savePlan(next);
      setLimits(next);
      setError('');
    } catch {
      setError('Could not save your limits. Check browser storage permissions.');
    }
  }
  async function handleSaveGoal(goal) {
    await goals.save(goal);
    setModal(null);
  }
  async function handleDeleteGoal(id) {
    await goals.remove(id);
    setModal(null);
  }
  const sorted = [...goals.items].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
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
      <AppTabs page="plan" navigate={navigate} />
      <div className="heading">
        <div>
          <h1>Your plan</h1>
          <span className="muted">Spending limits and savings goals.</span>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="panel plan-panel" aria-label="Spending limits">
        <div className="panel-head">
          <h2>How much I want to spend</h2>
        </div>
        {LIMIT_PERIODS.map((period) => (
          <LimitRow
            key={period}
            period={period}
            limit={limits[period]}
            spent={spentIn(entries, period)}
            onSave={saveLimit}
          />
        ))}
      </section>
      <section className="panel plan-panel" aria-label="Savings goals">
        <div className="panel-head">
          <h2>Savings goals</h2>
          <button className="text-btn" onClick={() => setModal({ type: 'goal' })}>
            + Add a goal
          </button>
        </div>
        {sorted.length === 0 && goals.status === 'ready' && (
          <div className="empty">
            <h2>No goals yet</h2>
            <p>Add something to save for and track how close you are.</p>
          </div>
        )}
        {sorted.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onSave={goals.save}
            onDelete={() => setModal({ type: 'delete', goal })}
          />
        ))}
      </section>
      {modal?.type === 'goal' && (
        <Modal title="Add a goal" onClose={() => setModal(null)}>
          <GoalForm onSave={handleSaveGoal} />
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <Modal title="Delete this goal?" onClose={() => setModal(null)}>
          <DeleteConfirmation
            entry={{ id: modal.goal.id, merchant: modal.goal.name }}
            onDelete={handleDeleteGoal}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </main>
  );
}
