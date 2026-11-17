import { useState } from 'react';
import {
  countDemoEntries,
  disableDemo,
  enableDemo,
  isDemoMode,
  removeDemoEntries,
  simulateIncoming,
} from '../../gmail/demo';
import {
  DEMO_ENTRIES,
  countSampleEntries,
  isAutoSeedOn,
  removeSampleEntries,
  seedDemoData,
  setAutoSeed,
} from '../../lib/demo-data';
import { getPrototype, setPrototype } from '../../lib/prototype';

function PrototypeSwitch() {
  const [prototype, setChoice] = useState(getPrototype);
  const isB = prototype === 'B';
  function choose(next) {
    setChoice(setPrototype(next));
  }
  return (
    <section className="panel account-panel">
      <h2>Prototype A / B</h2>
      <p className="section-description">
        Switch how the tracker shows your entries, to compare two designs side by side.
      </p>
      <div className="prototype-switch">
        <span className={isB ? '' : 'active'}>Prototype A</span>
        <button
          type="button"
          role="switch"
          aria-checked={isB}
          aria-label="Use Prototype B"
          className="switch"
          onClick={() => choose(isB ? 'A' : 'B')}
        >
          <i />
        </button>
        <span className={isB ? 'active' : ''}>Prototype B</span>
      </div>
      <p className="field-help" role="status">
        {isB
          ? 'B: insight-first. Three headline numbers and ranked category bars replace the donut and day bars, and entries are grouped by day with daily totals.'
          : 'A: the original layout. Total, donut chart and day bars, then one list of entries, newest first.'}
      </p>
    </section>
  );
}

function SampleData() {
  const [auto, setAuto] = useState(isAutoSeedOn);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function run(task) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch {
      setError('Something went wrong. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  }
  const reload = () =>
    run(async () => {
      const added = await seedDemoData();
      setMessage(
        added
          ? `Added ${added} sample ${added === 1 ? 'entry' : 'entries'}.`
          : 'All sample entries are already in your tracker.',
      );
    });
  const remove = () =>
    run(async () => {
      const removed = await removeSampleEntries();
      setConfirmRemove(false);
      setMessage(
        `Removed ${removed} sample ${removed === 1 ? 'entry' : 'entries'}. Your other entries were not touched.`,
      );
    });
  function toggleAuto() {
    setAutoSeed(!auto);
    setAuto(!auto);
  }
  return (
    <section className="panel account-panel">
      <h2>Sample data</h2>
      <p className="section-description">
        {DEMO_ENTRIES.length} made-up spends covering every day of November 2026, plus
        sample income, bills, savings goals and spending limits, so every screen has
        something to show.
      </p>
      <div className="data-action">
        <div>
          <h3>Add on sign-in</h3>
          <p>Adds the sample entries each time you sign in. Your own entries stay.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={auto}
          aria-label="Add sample data on sign-in"
          className="switch"
          onClick={toggleAuto}
        >
          <i />
        </button>
      </div>
      <div className="data-action">
        <div>
          <h3>Reload sample data</h3>
          <p>Puts back any sample entries you deleted.</p>
        </div>
        <button type="button" className="outline" disabled={busy} onClick={reload}>
          Reload sample data
        </button>
      </div>
      <div className="data-action">
        <div>
          <h3>Remove sample data</h3>
          <p>Deletes only the sample entries. Your manual and real entries are kept.</p>
        </div>
        {confirmRemove ? (
          <button type="button" className="danger" disabled={busy} onClick={remove}>
            Confirm: remove sample data
          </button>
        ) : (
          <button
            type="button"
            className="outline"
            disabled={busy}
            onClick={async () => {
              setMessage('');
              setConfirmRemove((await countSampleEntries()) > 0);
              if (!(await countSampleEntries()))
                setMessage('There is no sample data to remove.');
            }}
          >
            Remove sample data
          </button>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="save-feedback" role="status">
        {message}
      </p>
    </section>
  );
}

function GmailDemo() {
  const [demo, setDemo] = useState(isDemoMode);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  function start() {
    enableDemo();
    setDemo(true);
    setError('');
    setMessage(
      '6 simulated bank emails are waiting. Open the chat to see them collected.',
    );
  }
  function simulate() {
    const email = simulateIncoming();
    setMessage(
      `Simulated an email from ${email.merchant}. Open the chat and press Check now.`,
    );
  }
  async function removeDemo() {
    setError('');
    try {
      const removed = await removeDemoEntries();
      setConfirmRemove(false);
      setMessage(
        `Removed ${removed} demo ${removed === 1 ? 'entry' : 'entries'}. Your other entries were not touched.`,
      );
    } catch {
      setError('Could not remove the demo entries. Nothing was changed.');
    }
  }
  async function exit() {
    const remaining = await countDemoEntries();
    disableDemo();
    setDemo(false);
    setConfirmRemove(false);
    setMessage(
      remaining
        ? `Demo mode is off. ${remaining} demo ${remaining === 1 ? 'entry is' : 'entries are'} still in your tracker. Search “demo data” in the entry note to find them.`
        : 'Demo mode is off.',
    );
  }
  return (
    <section className="panel account-panel gmail-panel">
      <h2>{demo ? 'Gmail demo mode' : 'Gmail demo'}</h2>
      <p className="section-description">
        Simulated bank emails, not your real inbox. They go through the same steps as real
        ones: collected, saved automatically when clear, and held for review when not.
      </p>
      {!demo && (
        <div className="data-action">
          <div>
            <h3>Try the demo</h3>
            <p>No Google setup, and nothing is read from your inbox.</p>
          </div>
          <button type="button" className="outline" onClick={start}>
            Try the demo
          </button>
        </div>
      )}
      {demo && (
        <>
          <div className="data-action">
            <div>
              <h3>Simulate an incoming email</h3>
              <p>
                Queues one new bank alert. Open the chat and press Check now to see it
                arrive.
              </p>
            </div>
            <button type="button" className="outline" onClick={simulate}>
              Simulate email
            </button>
          </div>
          <div className="data-action">
            <div>
              <h3>Clean up</h3>
              <p>
                Removes only entries that came from demo emails. Your manual and real
                entries are never touched.
              </p>
            </div>
            {confirmRemove ? (
              <button type="button" className="danger" onClick={removeDemo}>
                Confirm: remove demo entries
              </button>
            ) : (
              <button
                type="button"
                className="outline"
                onClick={() => setConfirmRemove(true)}
              >
                Remove demo entries
              </button>
            )}
          </div>
          <div className="settings-actions">
            <button type="button" className="outline" onClick={exit}>
              Exit demo mode
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="save-feedback" role="status">
        {message}
      </p>
    </section>
  );
}

export function DemoSettings() {
  return (
    <>
      <PrototypeSwitch />
      <SampleData />
      <GmailDemo />
    </>
  );
}
