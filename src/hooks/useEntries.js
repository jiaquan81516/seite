import { useEffect, useState } from 'react';
import { entryStorage } from '../lib/storage';
export function useEntries() {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    let active = true;
    entryStorage
      .load()
      .then((records) => {
        if (active) {
          setEntries(records);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);
  async function saveEntry(entry) {
    await entryStorage.save(entry);
    setEntries((current) => [...current.filter((item) => item.id !== entry.id), entry]);
  }
  async function deleteEntry(id) {
    await entryStorage.remove(id);
    setEntries((current) => current.filter((item) => item.id !== id));
  }
  return { entries, status, saveEntry, deleteEntry };
}
