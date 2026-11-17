import { useState } from 'react';
import {
  clearGmailSettings,
  loadGmailSettings,
  saveGmailSettings,
  validateGmailSettings,
} from '../../gmail/settings';
import { pingGmail } from '../../gmail/client';
import { isDemoMode } from '../../gmail/demo';

const STEPS = [
  'Create a Google Apps Script project and paste in Code.gs and appsscript.json from the gmail-sync folder.',
  'Add GEMINI_API_KEY and a long random SEITE_SYNC_KEY under Script properties.',
  'Run setup once and approve read-only Gmail access.',
  'Deploy as a Web app: execute as you, access “Anyone”. Copy the /exec URL.',
  'Paste the URL and your sync key below.',
];

export function GmailSettings({ navigate }) {
  const [saved, setSaved] = useState(loadGmailSettings);
  const demo = isDemoMode();
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function connect(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const settings = validateGmailSettings({ url, key });
      const status = await pingGmail(settings);
      setSaved(saveGmailSettings(settings));
      setUrl('');
      setKey('');
      setMessage(
        `Connected. ${status.pending} transaction${status.pending === 1 ? '' : 's'} waiting. Open the chat to collect them.`,
      );
    } catch (failure) {
      setError(failure.message || 'Could not connect. Nothing was saved.');
    } finally {
      setBusy(false);
    }
  }
  function disconnect() {
    clearGmailSettings();
    setSaved(null);
    setError('');
    setMessage(
      'Disconnected from this browser. Your script keeps running until you stop it or delete its deployment.',
    );
  }
  return (
    <section className="panel account-panel gmail-panel">
      <h2>{demo ? 'Gmail demo mode' : saved ? 'Gmail is connected' : 'Connect Gmail'}</h2>
      <p className="section-description">
        {demo
          ? 'Simulated bank emails, not your real inbox. They go through the same steps as real ones: collected, saved automatically when clear, and held for review when not.'
          : 'A small script in your own Google account reads bank, wallet and receipt emails (read-only) every 15 minutes. Seite collects what it finds when you open the chat, saves clear transactions and asks you to check the rest.'}
      </p>
      {demo && (
        <div className="data-action">
          <div>
            <h3>Demo mode is on</h3>
            <p>Simulated emails are being used instead of a real script.</p>
          </div>
          <button type="button" className="outline" onClick={() => navigate?.('demo')}>
            Open the Demo tab
          </button>
        </div>
      )}
      {!demo && saved && (
        <div className="data-action">
          <div>
            <h3>Connected script</h3>
            <p>{saved.url.slice(0, 48)}… The sync key is saved on this device only.</p>
          </div>
          <button type="button" className="outline" onClick={disconnect}>
            Disconnect
          </button>
        </div>
      )}
      {!demo && !saved && (
        <>
          <div className="data-action">
            <div>
              <h3>Just want to see it work?</h3>
              <p>
                Simulated bank emails live in the Demo tab. No Google setup, and nothing
                is read from your inbox.
              </p>
            </div>
            <button type="button" className="outline" onClick={() => navigate?.('demo')}>
              Open the Demo tab
            </button>
          </div>
          <ol className="gmail-steps">
            {STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <form onSubmit={connect} noValidate>
            <label htmlFor="gmail-url">Web app URL</label>
            <input
              className="field"
              id="gmail-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              value={url}
              placeholder="https://script.google.com/macros/s/…/exec"
              onChange={(event) => setUrl(event.target.value)}
            />
            <label htmlFor="gmail-key">Sync key</label>
            <input
              className="field"
              id="gmail-key"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
            <div className="settings-actions">
              <button className="primary" disabled={busy || !url || !key}>
                {busy ? 'Checking…' : 'Connect'}
              </button>
            </div>
          </form>
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
      {!demo && (
        <p className="field-help">
          Privacy: card and account numbers, emails and phone numbers are masked, then
          each email’s text is sent to Gemini to read it. On Gemini’s free tier Google may
          use submitted content to improve its products. Email bodies are never stored.
          Narrow the script’s search to your banks if you prefer.
        </p>
      )}
    </section>
  );
}
