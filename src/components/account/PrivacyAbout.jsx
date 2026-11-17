import { version } from '../../../package.json';
import { useOnline } from '../../hooks/useOnline';
export function PrivacyAbout({ navigate }) {
  const online = useOnline();
  return (
    <section className="panel account-panel">
      <span className="account-status-pill">
        {online ? 'Online' : 'Offline'} · Local preview
      </span>
      <h2>On this device</h2>
      <p className="section-description">
        Seite {version} · A personal spending tracker.
      </p>
      <dl className="privacy-facts">
        <div>
          <dt>Spending history</dt>
          <dd>
            Stored in this browser’s IndexedDB on this device. There’s no cloud sync yet.
          </dd>
        </div>
        <div>
          <dt>Profile & preferences</dt>
          <dd>
            Saved locally when you choose Save. They aren’t a verified identity or an
            email connection.
          </dd>
        </div>
        <div>
          <dt>Passwords</dt>
          <dd>
            The dummy account forms never send, log or save passwords. No real account
            exists to reset or delete yet.
          </dd>
        </div>
        <div>
          <dt>Gmail, banks & AI</dt>
          <dd>
            Gmail connects only if you set it up under Gmail: a script in your own Google
            account reads matching emails read-only, masks card and account numbers, and
            sends each email’s text to Gemini. Email bodies are never stored. Banks are
            not connected. AI chat sends your chosen message/image and a compact spending
            summary when you press Send. Simple totals are calculated on this device.
            Previously local-only messages and entries stay out of cloud requests.
            Attachments aren’t retained in chat history.
          </dd>
        </div>
        <div>
          <dt>Analytics & advertising</dt>
          <dd>None in this version.</dd>
        </div>
        <div>
          <dt>Signing out</dt>
          <dd>
            Ends the local preview session. It doesn’t erase entries or lock browser
            storage. Use your device’s own access controls on shared devices.
          </dd>
        </div>
        <div>
          <dt>Downloaded backups</dt>
          <dd>
            Contain your entries and notes as readable files. Keep them somewhere you
            control. CSV is for spreadsheets; JSON can be restored in Seite.
          </dd>
        </div>
      </dl>
      <div className="settings-actions">
        <button className="outline" onClick={() => navigate('data')}>
          Manage your data ↗
        </button>
        <button className="plain-link" onClick={() => navigate('help')}>
          Read the help guide
        </button>
      </div>
    </section>
  );
}
