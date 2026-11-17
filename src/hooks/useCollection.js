import { useCallback, useEffect, useState } from 'react';

// Loads one stored collection and keeps the list in step with saves and deletes.
export function useCollection(storage) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    let active = true;
    storage
      .load()
      .then((loaded) => {
        if (active) {
          setItems(loaded);
          setStatus('ready');
        }
      })
      .catch(() => active && setStatus('error'));
    return () => {
      active = false;
    };
  }, [storage]);
  const save = useCallback(
    async (item) => {
      await storage.save(item);
      setItems((current) => [...current.filter((entry) => entry.id !== item.id), item]);
    },
    [storage],
  );
  const saveMany = useCallback(
    async (list) => {
      if (!list.length) return;
      await storage.saveMany(list);
      const ids = new Set(list.map((item) => item.id));
      setItems((current) => [...current.filter((entry) => !ids.has(entry.id)), ...list]);
    },
    [storage],
  );
  const remove = useCallback(
    async (id) => {
      await storage.remove(id);
      setItems((current) => current.filter((entry) => entry.id !== id));
    },
    [storage],
  );
  return { items, status, save, saveMany, remove };
}
