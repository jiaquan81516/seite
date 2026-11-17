import { SelectField } from '../SelectField';
import { useState } from 'react';
import { useAccount } from '../../account/AccountProvider';
import { PAYMENT_METHODS } from '../../lib/config';
export function PreferencesSettings() {
  const { preferences, saveAccount } = useAccount();
  const [draft, setDraft] = useState(preferences);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(preferences);
  function change(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setMessage('');
    setError('');
  }
  function save(event) {
    event.preventDefault();
    try {
      saveAccount({ preferences: draft });
      setMessage('Preferences saved. They’ll apply when you open the tracker.');
      setError('');
    } catch (error) {
      setError(error.message);
    }
  }
  return (
    <section className="panel account-panel">
      <h2>Defaults</h2>
      <p className="section-description">Defaults for the tracker.</p>
      <form onSubmit={save}>
        <label htmlFor="default-period">Open the tracker in</label>
        <SelectField
          id="default-period"
          value={draft.defaultPeriod}
          onValueChange={(value) => change('defaultPeriod', value)}
          options={['Day', 'Week', 'Month']}
          placeholder="Choose a period"
        />
        <label htmlFor="default-method">Default payment method</label>
        <SelectField
          id="default-method"
          value={draft.defaultMethod}
          onValueChange={(value) => change('defaultMethod', value)}
          options={PAYMENT_METHODS}
          placeholder="Choose each time"
        />
        <p className="field-help">
          Pre-fills new spends. You can still change it on each entry.
        </p>
        <label className="preference-toggle">
          <span>
            <strong>Reduce motion</strong>
            <small>
              Keep page transitions and loading effects still. Your device’s
              reduced-motion setting is always respected.
            </small>
          </span>
          <input
            type="checkbox"
            checked={draft.reduceMotion}
            onChange={(event) => change('reduceMotion', event.target.checked)}
          />
        </label>
        <div className="read-only-setting">
          <span>Home currency & region</span>
          <strong>SGD · Singapore</strong>
          <p>
            Foreign-currency receipts in AI chat use a freshly checked reference rate and
            keep the original amount in their notes.
          </p>
        </div>
        <div className="read-only-setting">
          <span>Appearance</span>
          <strong>Light · warm cream</strong>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="save-feedback" role="status">
          {message}
        </p>
        <div className="settings-actions">
          <button className="primary" disabled={!dirty}>
            Save preferences
          </button>
          <button
            className="outline"
            type="button"
            disabled={!dirty}
            onClick={() => {
              setDraft(preferences);
              setMessage('Changes discarded.');
              setError('');
            }}
          >
            Discard changes
          </button>
        </div>
      </form>
    </section>
  );
}
