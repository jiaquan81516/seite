import { beforeEach, expect, it, vi } from 'vitest';
import { appendCompletion, savedEntriesText } from '../src/chat/completion-messages';
import { entryStorage } from '../src/lib/storage';
import { loadConversation, saveReviewedEntries } from '../src/chat/storage';
import { makeEntry } from './fixtures';

beforeEach(async () => {
  await entryStorage.clear();
});
it('creates a local assistant confirmation and deduplicates the same completion', () => {
  const details = { key: 'save:123', text: 'Saved your entry.', sensitive: true };
  const next = appendCompletion([], details);
  expect(next).toHaveLength(1);
  expect(next[0]).toMatchObject({
    role: 'assistant',
    text: details.text,
    sensitive: true,
    completionKey: details.key,
  });
  expect(appendCompletion(next, details)).toBe(next);
});
it('formats an accurate confirmation for a selected batch', () => {
  expect(
    savedEntriesText([makeEntry(), makeEntry({ id: 'ride', amount_cents: 750 })]),
  ).toBe('Saved 2 entries totalling S$16.70 to your tracker.');
});
it('redacts account-like numbers from generated messages', () => {
  const messages = appendCompletion([], {
    key: 'save:123',
    text: savedEntriesText([makeEntry({ merchant: 'Shop 1234 5678 9012 3456' })]),
  });
  expect(messages[0].text).not.toContain('1234');
  expect(messages[0].text).toContain('[number removed]');
});
it('commits confirmations for actual inserts and does not duplicate them on an idempotent retry', async () => {
  const record = makeEntry({ external_ref: 'receipt-123' });
  let history = [];
  const messages = vi.fn((savedIds) => {
    if (savedIds.length)
      history = appendCompletion(history, {
        key: 'save:123',
        text: savedEntriesText([record]),
      });
    return history;
  });
  await saveReviewedEntries({ records: [record], messages });
  await saveReviewedEntries({ records: [record], messages });
  expect(messages.mock.calls).toEqual([[[record.id]], [[]]]);
  expect(await entryStorage.load()).toHaveLength(1);
  expect(await loadConversation()).toHaveLength(1);
});
it('never persists a success message when the entry transaction aborts', async () => {
  await entryStorage.save(makeEntry());
  const messages = vi.fn(() => appendCompletion([], { key: 'bad-save', text: 'Saved!' }));
  await expect(
    saveReviewedEntries({ records: [makeEntry({ id: 'duplicate' })], messages }),
  ).rejects.toThrow(/looks like/);
  expect(messages).not.toHaveBeenCalled();
  expect(await loadConversation()).toEqual([]);
});
