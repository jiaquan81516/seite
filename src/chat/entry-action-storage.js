import { openDatabase } from '../lib/storage';

function sameRecord(left, right) {
  const keys = Object.keys(left || {});
  return (
    Boolean(left && right) &&
    keys.length === Object.keys(right).length &&
    keys.every((key) => JSON.stringify(left[key]) === JSON.stringify(right[key]))
  );
}

// Entry changes and the completed chat action commit together. Comparing the
// reviewed snapshot also protects against edits from another tab or stale cards.
export async function commitEntryAction({ expected, replacement, messages }) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['records', 'chat'], 'readwrite');
    const records = transaction.objectStore('records');
    let failure;
    records.get((expected || replacement).id).onsuccess = (event) => {
      const current = event.target.result;
      if (expected ? !sameRecord(current, expected) : Boolean(current)) {
        failure = new Error(
          'This entry has changed or was removed since the preview. Ask again to review the current version.',
        );
        transaction.abort();
        return;
      }
      if (replacement) records.put(replacement);
      else records.delete(expected.id);
      transaction.objectStore('chat').put({ id: 'main', messages: messages.slice(-100) });
    };
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () =>
      reject(failure || transaction.error);
  });
}

// Remove several reviewed entries in ONE transaction with the chat update. Every
// entry must still match the snapshot shown in the preview, otherwise nothing
// is removed.
export async function commitBulkDelete({ expected, messages }) {
  if (!expected.length) throw new Error('Select at least one entry to remove.');
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['records', 'chat'], 'readwrite');
    const records = transaction.objectStore('records');
    let remaining = expected.length;
    let failure;
    for (const entry of expected) {
      records.get(entry.id).onsuccess = (event) => {
        if (failure) return;
        if (!sameRecord(event.target.result, entry)) {
          failure = new Error(
            'Some entries changed or were removed since the preview. Nothing was removed. Ask again to review the current entries.',
          );
          transaction.abort();
          return;
        }
        records.delete(entry.id);
        remaining -= 1;
        if (!remaining)
          transaction
            .objectStore('chat')
            .put({ id: 'main', messages: messages.slice(-100) });
      };
    }
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () =>
      reject(failure || transaction.error);
  });
}

// Undo for a bulk removal: put every removed entry back, or none of them.
export async function commitBulkRestore({ entries, messages }) {
  if (!entries.length) throw new Error('There is nothing to restore.');
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['records', 'chat'], 'readwrite');
    const records = transaction.objectStore('records');
    let remaining = entries.length;
    let failure;
    for (const entry of entries) {
      records.get(entry.id).onsuccess = (event) => {
        if (failure) return;
        if (event.target.result) {
          failure = new Error(
            'An entry with the same ID already exists, so nothing was restored. Use your JSON backup to restore it instead.',
          );
          transaction.abort();
          return;
        }
        records.put(entry);
        remaining -= 1;
        if (!remaining)
          transaction
            .objectStore('chat')
            .put({ id: 'main', messages: messages.slice(-100) });
      };
    }
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () =>
      reject(failure || transaction.error);
  });
}
