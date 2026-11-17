import { planBackupImport } from './backups';

// Keep the original database and store names so existing M1 entries survive.
let databasePromise;
export function openDatabase() {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('seite-tracker', 3);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('records'))
        database.createObjectStore('records', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('chat'))
        database.createObjectStore('chat', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('merchant_rules'))
        database.createObjectStore('merchant_rules', { keyPath: 'merchant' });
      for (const name of ['income', 'bills', 'goals'])
        if (!database.objectStoreNames.contains(name))
          database.createObjectStore(name, { keyPath: 'id' });
    };
    request.onerror = () => {
      databasePromise = undefined;
      reject(request.error);
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        databasePromise = undefined;
      };
      resolve(request.result);
    };
  });
  return databasePromise;
}
async function writeRecord(operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('records', 'readwrite');
    operation(transaction.objectStore('records'));
    // A request succeeding does not guarantee the transaction has committed.
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Storage transaction aborted.'));
  });
}
export const entryStorage = {
  async load() {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = database.transaction('records').objectStore('records').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  save(entry) {
    return writeRecord((store) => store.put(entry));
  },
  async clear() {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const names = ['records', 'chat', 'merchant_rules', 'income', 'bills', 'goals'];
      const transaction = database.transaction(names, 'readwrite');
      for (const name of names) transaction.objectStore(name).clear();
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error);
    });
  },
  async importBackup(records) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite');
      const store = transaction.objectStore('records');
      const request = store.getAll();
      let plan;
      let failure;
      request.onsuccess = () => {
        try {
          // Re-check inside the write transaction in case another tab changed data.
          plan = planBackupImport(records, request.result);
          for (const record of plan.added) store.add(record);
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
      transaction.oncomplete = () =>
        resolve({ added: plan.added.length, skipped: plan.skipped });
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(
          failure ??
            transaction.error ??
            new Error('Import cancelled. No entries were changed.'),
        );
    });
  },
  remove(id) {
    return writeRecord((store) => store.delete(id));
  },
  removeMany(ids) {
    return writeRecord((store) => {
      for (const id of ids) store.delete(id);
    });
  },
};
