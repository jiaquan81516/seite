import { beforeEach, describe, expect, it } from 'vitest';
import { entryStorage } from '../src/lib/storage';
import {
  BULK_MAX_ENTRIES,
  createBulkProposal,
  describeFilter,
  needsTypedConfirmation,
} from '../src/chat/bulk-delete';
import { commitBulkDelete, commitBulkRestore } from '../src/chat/entry-action-storage';
import { makeEntry } from './fixtures';

const noFilter = {
  category: null,
  method: null,
  merchant: null,
  date_from: null,
  date_to: null,
};
const bulk = (filter) => ({
  type: 'bulk_delete',
  target_id: null,
  changes: null,
  filter: { ...noFilter, ...filter },
});
const entries = () => [
  makeEntry({
    id: 'a',
    merchant: 'Grab ride',
    category: 'Transport',
    date: '2026-10-03',
  }),
  makeEntry({
    id: 'b',
    merchant: 'GrabFood',
    category: 'Food & Drink',
    date: '2026-10-20',
  }),
  makeEntry({
    id: 'c',
    merchant: 'NTUC',
    category: 'Groceries',
    date: '2026-11-02',
    method: 'Cash',
  }),
];

beforeEach(async () => {
  await entryStorage.clear();
});

describe('bulk removal proposals', () => {
  it('lets the app resolve a filter into the matching saved entries', () => {
    const proposal = createBulkProposal(bulk({ merchant: 'grab' }), entries());
    expect(proposal.matches.map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(proposal.status).toBe('pending');
  });
  it('combines every filter field', () => {
    const proposal = createBulkProposal(
      bulk({ merchant: 'grab', date_from: '2026-10-10', date_to: '2026-10-31' }),
      entries(),
    );
    expect(proposal.matches.map((entry) => entry.id)).toEqual(['b']);
    expect(describeFilter(proposal.filter)).toContain('merchant contains “grab”');
  });
  it('rejects an empty filter so "delete everything" cannot slip through', () => {
    expect(() => createBulkProposal(bulk({ merchant: '   ' }), entries())).toThrow(
      /which entries to remove/,
    );
  });
  it('rejects unreadable or reversed dates and zero matches', () => {
    expect(() => createBulkProposal(bulk({ date_from: 'last week' }), entries())).toThrow(
      /date range/,
    );
    expect(() =>
      createBulkProposal(
        bulk({ date_from: '2026-11-05', date_to: '2026-11-01' }),
        entries(),
      ),
    ).toThrow(/start date/);
    expect(() => createBulkProposal(bulk({ merchant: 'zzz' }), entries())).toThrow(
      /nothing will be removed/,
    );
  });
  it('refuses matches too large to review', () => {
    const many = Array.from({ length: BULK_MAX_ENTRIES + 1 }, (_, index) =>
      makeEntry({ id: `m${index}` }),
    );
    expect(() => createBulkProposal(bulk({ category: 'Food & Drink' }), many)).toThrow(
      /Narrow it/,
    );
  });
  it('asks for the typed count only from ten entries upward', () => {
    expect(needsTypedConfirmation(9)).toBe(false);
    expect(needsTypedConfirmation(10)).toBe(true);
  });
});

describe('bulk removal storage', () => {
  it('removes all reviewed entries together and restores them together', async () => {
    const saved = entries();
    for (const entry of saved) await entryStorage.save(entry);
    await commitBulkDelete({ expected: saved.slice(0, 2), messages: [] });
    expect((await entryStorage.load()).map((entry) => entry.id)).toEqual(['c']);
    await commitBulkRestore({ entries: saved.slice(0, 2), messages: [] });
    expect(await entryStorage.load()).toHaveLength(3);
  });
  it('removes nothing when any entry changed since the preview', async () => {
    const saved = entries();
    for (const entry of saved) await entryStorage.save(entry);
    await entryStorage.save({ ...saved[1], amount_cents: 1 });
    await expect(commitBulkDelete({ expected: saved, messages: [] })).rejects.toThrow(
      /Nothing was removed/,
    );
    expect(await entryStorage.load()).toHaveLength(3);
  });
  it('restores nothing when one entry already exists again', async () => {
    const saved = entries();
    await entryStorage.save(saved[0]);
    await expect(
      commitBulkRestore({ entries: saved.slice(0, 2), messages: [] }),
    ).rejects.toThrow(/nothing was restored/);
    expect(await entryStorage.load()).toHaveLength(1);
  });
});
