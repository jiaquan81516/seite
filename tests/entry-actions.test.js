import { beforeEach, describe, expect, it } from 'vitest';
import { entryStorage } from '../src/lib/storage';
import {
  createActionProposal,
  isRecentRemoval,
  recentRemoval,
  updatedEntry,
} from '../src/chat/entry-actions';
import { commitEntryAction } from '../src/chat/entry-action-storage';
import { loadConversation, saveConversation } from '../src/chat/storage';
import { buildChatContext } from '../src/chat/context';
import { makeEntry } from './fixtures';
const emptyChanges = {
  merchant: null,
  amount_cents: null,
  date: null,
  time: null,
  category: null,
  method: null,
  note: null,
};

beforeEach(async () => {
  await entryStorage.clear();
});
describe('saved entry action proposals', () => {
  it.each([
    'remove the recently added log',
    'Delete my last entry.',
    'undo the latest spend',
  ])('recognizes %s locally', (text) => {
    expect(isRecentRemoval(text)).toBe(true);
  });
  it.each([
    'remove all entries',
    'remove the last two logs',
    'read this receipt and remove the last entry',
    'how much did I spend today?',
  ])('does not guess an action for %s', (text) => {
    expect(isRecentRemoval(text)).toBe(false);
  });
  it('uses saved time instead of transaction date, in both local and cloud context', () => {
    const oldReceipt = makeEntry({
      id: 'newly-added',
      date: '2026-06-19',
      created_at: '2026-11-17T07:00:00Z',
    });
    const olderSave = makeEntry({
      date: '2026-11-17',
      created_at: '2026-11-17T06:00:00Z',
    });
    expect(recentRemoval([olderSave, oldReceipt]).targetId).toBe('newly-added');
    expect(buildChatContext([olderSave, oldReceipt], []).request.recent[0].id).toBe(
      'newly-added',
    );
  });
  it('asks the user to choose when several entries were added together', () => {
    const proposal = recentRemoval([makeEntry(), makeEntry({ id: 'second' })]);
    expect(proposal.targetId).toBe('');
    expect(proposal.options).toHaveLength(2);
  });
  it('rejects invented IDs, empty updates and fields outside the allowlist', () => {
    expect(() =>
      createActionProposal({ type: 'delete', target_id: 'invented', changes: null }, [
        makeEntry(),
      ]),
    ).toThrow(/no longer/);
    expect(() =>
      createActionProposal({ type: 'update', target_id: 'cafe', changes: emptyChanges }, [
        makeEntry(),
      ]),
    ).toThrow(/what you/);
    expect(() =>
      createActionProposal(
        {
          type: 'update',
          target_id: 'cafe',
          changes: { ...emptyChanges, id: 'replace-id' },
        },
        [makeEntry()],
      ),
    ).toThrow();
  });
  it('preserves IDs and audit fields while validating updated amounts and dates', () => {
    const original = makeEntry({ external_ref: 'original-receipt' });
    expect(updatedEntry(original, { amount_cents: 1170, method: 'Cash' })).toMatchObject({
      id: original.id,
      amount_cents: 1170,
      method: 'Cash',
      external_ref: original.external_ref,
      created_at: original.created_at,
    });
    expect(() => updatedEntry(original, { amount_cents: -1 })).toThrow();
    expect(() => updatedEntry(original, { date: '2026-02-30' })).toThrow();
    expect(() =>
      updatedEntry({ ...original, currency: 'MYR' }, { amount_cents: 1000 }),
    ).toThrow(/foreign-currency/);
  });
});
describe('atomic entry actions', () => {
  it('commits deletion and its chat status together, then can restore the original', async () => {
    const before = makeEntry();
    await entryStorage.save(before);
    await commitEntryAction({
      expected: before,
      replacement: null,
      messages: [{ id: 'removed', text: 'Removed' }],
    });
    expect(await entryStorage.load()).toEqual([]);
    expect(await loadConversation()).toEqual([{ id: 'removed', text: 'Removed' }]);
    await commitEntryAction({
      expected: null,
      replacement: before,
      messages: [{ id: 'restored', text: 'Restored' }],
    });
    expect(await entryStorage.load()).toEqual([before]);
  });
  it('rejects a stale preview without changing the record or chat', async () => {
    const original = makeEntry();
    const changed = { ...original, amount_cents: 500 };
    await entryStorage.save(changed);
    await saveConversation([{ id: 'existing' }]);
    await expect(
      commitEntryAction({ expected: original, replacement: null, messages: [] }),
    ).rejects.toThrow(/has changed/);
    expect(await entryStorage.load()).toEqual([changed]);
    expect(await loadConversation()).toEqual([{ id: 'existing' }]);
  });
  it('does not overwrite another record when Undo would conflict', async () => {
    const current = makeEntry({ amount_cents: 500 });
    await entryStorage.save(current);
    await expect(
      commitEntryAction({ expected: null, replacement: makeEntry(), messages: [] }),
    ).rejects.toThrow(/has changed/);
    expect(await entryStorage.load()).toEqual([current]);
  });
});
