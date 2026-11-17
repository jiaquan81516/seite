import { describe, expect, it } from 'vitest';
import { findRestorable, isRestoreRequest } from '../src/chat/restore';
import { isRecentRemoval } from '../src/chat/entry-actions';
import { makeEntry } from './fixtures';

describe('restore requests', () => {
  it.each([
    'add back the deleted data',
    'Add them back',
    'put back the removed entries',
    'restore the deleted entries',
    'restore my deleted data please',
    'undo the removal',
    'undo the deletion',
    'bring back the deleted spendings',
  ])('recognises %s', (text) => {
    expect(isRestoreRequest(text)).toBe(true);
  });
  it.each([
    'undo the latest spend',
    'delete my last entry',
    'how much did I spend today',
    'add my spending today',
    'add back 5 dollars to food',
  ])('leaves %s alone', (text) => {
    expect(isRestoreRequest(text)).toBe(false);
  });
  it('keeps "undo the latest spend" as a removal request', () => {
    expect(isRecentRemoval('undo the latest spend')).toBe(true);
  });
  it('finds the newest removal that is still applied', () => {
    const a = makeEntry({ id: 'a' });
    const b = makeEntry({ id: 'b' });
    const messages = [
      { id: '1', action: { type: 'delete', status: 'undone', before: a } },
      { id: '2', action: { type: 'bulk_delete', status: 'applied', removed: [a, b] } },
      { id: '3', action: { type: 'delete', status: 'pending', options: [a] } },
    ];
    expect(findRestorable(messages)).toEqual({ sourceId: '2', entries: [a, b] });
    expect(findRestorable([messages[0], messages[2]])).toBeNull();
  });
});
