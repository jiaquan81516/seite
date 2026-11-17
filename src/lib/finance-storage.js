import { openDatabase } from './storage';

// Income, bills and goals live beside the entries in the same IndexedDB database.
function collection(name) {
  async function run(mode, operation) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(name, mode);
      const request = operation(transaction.objectStore(name));
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Storage transaction aborted.'));
    });
  }
  return {
    load: () => run('readonly', (store) => store.getAll()).then((items) => items ?? []),
    save: (item) => run('readwrite', (store) => store.put(item)),
    saveMany: (items) =>
      run('readwrite', (store) => {
        for (const item of items) store.put(item);
      }),
    remove: (id) => run('readwrite', (store) => store.delete(id)),
    removeMany: (ids) =>
      run('readwrite', (store) => {
        for (const id of ids) store.delete(id);
      }),
  };
}
export const incomeStorage = collection('income');
export const billStorage = collection('bills');
export const goalStorage = collection('goals');
