import { expect, it } from 'vitest';
import { entryStorage } from '../src/lib/storage';
import { makeEntry } from './fixtures';
it('persists, loads, updates and removes entries in IndexedDB', async () => {
  const entry = makeEntry({ id: 'storage-test' });
  await entryStorage.save(entry);
  expect(await entryStorage.load()).toContainEqual(entry);
  await entryStorage.save({ ...entry, amount_cents: 1010 });
  const loaded = (await entryStorage.load()).filter((item) => item.id === entry.id);
  expect(loaded).toHaveLength(1);
  expect(loaded[0].amount_cents).toBe(1010);
  await entryStorage.remove(entry.id);
  expect(await entryStorage.load()).not.toContainEqual(
    expect.objectContaining({ id: entry.id }),
  );
});

it('imports matching backups once and rejects conflicting batches atomically', async () => {
  await entryStorage.clear();
  const existing = makeEntry();
  await entryStorage.save(existing);
  const fresh = makeEntry({ id: 'fresh' });
  await expect(entryStorage.importBackup([existing, fresh])).resolves.toEqual({
    added: 1,
    skipped: 1,
  });
  await expect(entryStorage.importBackup([existing, fresh])).resolves.toEqual({
    added: 0,
    skipped: 2,
  });
  const another = makeEntry({ id: 'another' });
  await expect(
    entryStorage.importBackup([another, { ...existing, amount_cents: 500 }]),
  ).rejects.toThrow(/conflicts/);
  expect((await entryStorage.load()).map((record) => record.id).sort()).toEqual([
    'cafe',
    'fresh',
  ]);
  await entryStorage.clear();
});
