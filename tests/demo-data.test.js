import { describe, expect, it } from 'vitest';
import { DEMO_ENTRIES, seedDemoData } from '../src/lib/demo-data';
import { entryStorage } from '../src/lib/storage';
import { makeEntry } from './fixtures';

describe('built-in November sample data', () => {
  it('covers every day of November 2026 with valid entries', () => {
    const days = new Set(DEMO_ENTRIES.map((entry) => entry.date));
    expect(days.size).toBe(30);
    expect([...days].every((day) => day.startsWith('2026-11-'))).toBe(true);
  });
  it('adds the sample once and keeps other entries', async () => {
    await entryStorage.clear();
    await entryStorage.save(makeEntry({ id: 'mine' }));
    expect(await seedDemoData()).toBe(DEMO_ENTRIES.length);
    expect(await seedDemoData()).toBe(0);
    const saved = await entryStorage.load();
    expect(saved).toHaveLength(DEMO_ENTRIES.length + 1);
    expect(saved.some((entry) => entry.id === 'mine')).toBe(true);
  });
  it('does not bring back a sample entry the person edited', async () => {
    await entryStorage.clear();
    await seedDemoData();
    await entryStorage.save({ ...DEMO_ENTRIES[0], merchant: 'Edited' });
    expect(await seedDemoData()).toBe(0);
    const saved = await entryStorage.load();
    expect(saved.find((entry) => entry.id === DEMO_ENTRIES[0].id).merchant).toBe(
      'Edited',
    );
  });
});
