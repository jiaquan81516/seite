import { useEffect, useState } from 'react';
import { useAccount } from '../account/AccountProvider';
import { entryStorage } from '../lib/storage';
import {
  createBackup,
  createCsv,
  downloadEntries,
  MAX_BACKUP_BYTES,
  parseBackup,
  planBackupImport,
} from '../lib/backups';

export function useDataControls(onDeleted) {
  const { resetAccount } = useAccount();
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    let active = true;
    entryStorage
      .load()
      .then((records) => {
        if (active) setEntries(records);
      })
      .catch(() => {
        if (active) setError('Your entries could not be loaded. Reload and try again.');
      });
    return () => {
      active = false;
    };
  }, []);
  async function exportData(format) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const records = await entryStorage.load();
      setEntries(records);
      const csv = format === 'csv';
      downloadEntries(
        csv ? createCsv(records) : createBackup(records),
        csv ? 'csv' : 'json',
        csv ? 'text/csv;charset=utf-8' : 'application/json',
      );
      setMessage('Your download has been prepared. Check your browser’s downloads.');
    } catch {
      setError('The export could not be prepared. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function inspectBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw new Error('Choose a backup smaller than 5 MB.');
      const records = parseBackup(await file.text());
      const current = await entryStorage.load();
      setEntries(current);
      const plan = planBackupImport(records, current);
      if (plan.added.length === 0) {
        setMessage(`Nothing new to restore. ${plan.skipped} entries are already saved.`);
        return;
      }
      setReview({ records, ...plan });
    } catch (error) {
      setError(error.message || 'This backup could not be read.');
    } finally {
      setBusy(false);
    }
  }
  async function restoreBackup() {
    setBusy(true);
    setError('');
    try {
      const result = await entryStorage.importBackup(review.records);
      setEntries(await entryStorage.load());
      setReview(null);
      setMessage(
        `${result.added} entries restored. ${result.skipped} already-saved entries skipped.`,
      );
    } catch (error) {
      setError(error.message || 'Restore failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function deleteData() {
    setBusy(true);
    setError('');
    try {
      await entryStorage.clear();
      setEntries([]);
      try {
        resetAccount();
      } catch {
        throw new Error(
          'Entries were deleted, but your profile or preferences could not be removed. Keep this page open and retry to finish.',
        );
      }
      setDeleting(false);
      onDeleted();
    } catch (error) {
      setError(error.message || 'Data could not be deleted. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return {
    entries,
    error,
    message,
    busy,
    review,
    deleting,
    exportData,
    inspectBackup,
    restoreBackup,
    deleteData,
    closeReview: () => setReview(null),
    closeDeletion: () => setDeleting(false),
    beginDeletion: () => {
      setDeleting(true);
      setError('');
    },
  };
}
