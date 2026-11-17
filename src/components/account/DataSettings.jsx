import { useDataControls } from '../../hooks/useDataControls';
import { formatMoney, totalAmount } from '../../lib/money';
import { RestoreBackupDialog } from './RestoreBackupDialog';
import { DeleteLocalDataDialog } from './DeleteLocalDataDialog';

export function DataSettings({ onDeleted }) {
  const controls = useDataControls(onDeleted);
  const { entries, error, message, busy, review, deleting, exportData, inspectBackup } =
    controls;
  const unavailable = entries === null || busy;
  return (
    <>
      <section className="panel account-panel">
        <div className="data-summary">
          <div>
            <span className="eyebrow">ON THIS DEVICE</span>
            <h2>
              {entries === null
                ? 'Loading your entries…'
                : `${entries.length} saved entries`}
            </h2>
          </div>
          <span>{entries === null ? '—' : formatMoney(totalAmount(entries))}</span>
        </div>
        <p className="section-description">
          Your entries are stored in this browser. Keep a backup before clearing browser
          data or changing devices.
        </p>
        <div className="data-action">
          <div>
            <h3>Entries backup</h3>
            <p>
              A JSON file you can restore in Seite. Includes all entries, with their
              notes. Profile, preferences, chat history and learned merchant categories
              aren’t included.
            </p>
          </div>
          <button
            className="outline"
            disabled={unavailable}
            onClick={() => exportData('json')}
          >
            Download JSON backup
          </button>
        </div>
        <div className="data-action">
          <div>
            <h3>Spreadsheet export</h3>
            <p>
              All entries as CSV, ready for a spreadsheet. Use JSON if you want to restore
              them in Seite later.
            </p>
          </div>
          <button
            className="outline"
            disabled={unavailable}
            onClick={() => exportData('csv')}
          >
            Export CSV
          </button>
        </div>
        <div className="data-action">
          <div>
            <h3>Restore a backup</h3>
            <p>
              Choose a Seite JSON backup, then review before importing. Existing entries
              are kept, and matching IDs aren’t added twice. Up to 5 MB.
            </p>
          </div>
          <label className="backup-file-label" htmlFor="backup-file">
            Seite backup file
          </label>
          <input
            id="backup-file"
            className="backup-file-input"
            type="file"
            accept=".json,application/json"
            disabled={unavailable}
            onChange={inspectBackup}
          />
        </div>
      </section>
      <section className="panel account-panel danger-panel">
        <h2>Delete local data</h2>
        <p className="section-description">
          Delete every saved entry, chat history, learned merchant categories, profile and
          preferences on this browser. This can’t be undone without an entries backup.
          Other devices and downloaded files are unaffected.
        </p>
        <button
          className="danger"
          disabled={unavailable}
          onClick={controls.beginDeletion}
        >
          Delete all local data
        </button>
      </section>
      {!deleting && !review && error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="save-feedback" role="status">
        {message}
      </p>
      {review && (
        <RestoreBackupDialog
          review={review}
          busy={busy}
          error={error}
          onRestore={controls.restoreBackup}
          onClose={controls.closeReview}
        />
      )}
      {deleting && (
        <DeleteLocalDataDialog
          busy={busy}
          error={error}
          onBackup={() => exportData('json')}
          onDelete={controls.deleteData}
          onClose={controls.closeDeletion}
        />
      )}
    </>
  );
}
