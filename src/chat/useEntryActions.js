import { useRef } from 'react';
import { entryStorage } from '../lib/storage';
import { actionMessages, updatedEntry } from './entry-actions';
import {
  commitBulkDelete,
  commitBulkRestore,
  commitEntryAction,
} from './entry-action-storage';
import { bulkRemovalText, needsTypedConfirmation } from './bulk-delete';
import { restoreText } from './restore';
import { saveConversation } from './storage';
import { appendCompletion, entryLabel } from './completion-messages';

export function useEntryActions({
  messages,
  setMessages,
  setEntries,
  activity,
  setActivity,
}) {
  const running = useRef(false);
  async function perform(operation) {
    if (activity || running.current)
      throw new Error('Wait for the current request to finish.');
    running.current = true;
    setActivity('saving');
    try {
      await operation();
    } finally {
      running.current = false;
      setActivity('');
    }
  }
  async function apply(messageId, targetId) {
    await perform(async () => {
      const action = messages.find((message) => message.id === messageId)?.action;
      if (action?.status !== 'pending')
        throw new Error('This action is no longer pending.');
      const before = action.options.find((entry) => entry.id === targetId);
      if (!before || (action.targetId && action.targetId !== targetId))
        throw new Error('Choose one of the entries shown in this preview.');
      const after =
        action.type === 'delete' ? null : updatedEntry(before, action.changes);
      const next = appendCompletion(
        actionMessages(messages, messageId, {
          status: 'applied',
          before,
          after,
          targetId,
          options: [],
        }),
        {
          key: `${messageId}:applied`,
          text:
            action.type === 'delete'
              ? `Removed ${entryLabel(before)} from your tracker.`
              : `Updated ${entryLabel(after)} in your tracker.`,
          sensitive:
            before.sensitive ||
            messages.find((message) => message.id === messageId)?.sensitive,
        },
      );
      await commitEntryAction({ expected: before, replacement: after, messages: next });
      setMessages(next);
      setEntries(await entryStorage.load());
    });
  }
  async function cancel(messageId) {
    await perform(async () => {
      const action = messages.find((message) => message.id === messageId)?.action;
      if (action?.status !== 'pending') return;
      const next = actionMessages(messages, messageId, {
        status: 'cancelled',
        options: [],
      });
      await saveConversation(next);
      setMessages(next);
    });
  }
  async function undo(messageId) {
    await perform(async () => {
      const action = messages.find((message) => message.id === messageId)?.action;
      if (action?.status !== 'applied')
        throw new Error('This action cannot be undone again.');
      const next = appendCompletion(
        actionMessages(messages, messageId, { status: 'undone' }),
        {
          key: `${messageId}:undone`,
          text: `Undone. Restored ${entryLabel(action.before)} in your tracker.`,
          sensitive:
            action.before.sensitive ||
            messages.find((message) => message.id === messageId)?.sensitive,
        },
      );
      await commitEntryAction({
        expected: action.after,
        replacement: action.before,
        messages: next,
      });
      setMessages(next);
      setEntries(await entryStorage.load());
    });
  }
  async function applyBulk(messageId, selectedIds, typedCount = '') {
    await perform(async () => {
      const message = messages.find((item) => item.id === messageId);
      const action = message?.action;
      if (action?.type !== 'bulk_delete' || action.status !== 'pending')
        throw new Error('This action is no longer pending.');
      const chosen = new Set(selectedIds);
      const removed = action.matches.filter((entry) => chosen.has(entry.id));
      if (!removed.length || removed.length !== chosen.size)
        throw new Error('Choose entries from the list in this preview.');
      // The count must be typed back for larger removals, enforced here as well
      // as in the card so a stale or scripted call cannot skip it.
      if (
        needsTypedConfirmation(removed.length) &&
        typedCount.trim() !== String(removed.length)
      )
        throw new Error(`Type ${removed.length} to confirm this removal.`);
      const next = appendCompletion(
        actionMessages(messages, messageId, {
          status: 'applied',
          removed,
          matches: [],
        }),
        {
          key: `${messageId}:applied`,
          text: `Removed ${bulkRemovalText(removed)} from your tracker. You can undo this or download a backup of them.`,
          sensitive: removed.some((entry) => entry.sensitive) || message.sensitive,
        },
      );
      await commitBulkDelete({ expected: removed, messages: next });
      setMessages(next);
      setEntries(await entryStorage.load());
    });
  }
  async function undoBulk(messageId) {
    await perform(async () => {
      const message = messages.find((item) => item.id === messageId);
      const action = message?.action;
      if (action?.type !== 'bulk_delete' || action.status !== 'applied')
        throw new Error('This action cannot be undone again.');
      const next = appendCompletion(
        actionMessages(messages, messageId, { status: 'undone' }),
        {
          key: `${messageId}:undone`,
          text: `Undone. Restored ${bulkRemovalText(action.removed)} in your tracker.`,
          sensitive: action.removed.some((entry) => entry.sensitive) || message.sensitive,
        },
      );
      await commitBulkRestore({ entries: action.removed, messages: next });
      setMessages(next);
      setEntries(await entryStorage.load());
    });
  }
  async function applyRestore(messageId) {
    await perform(async () => {
      const message = messages.find((item) => item.id === messageId);
      const action = message?.action;
      if (action?.type !== 'restore' || action.status !== 'pending')
        throw new Error('This action is no longer pending.');
      // The removal card being restored is marked undone in the same save.
      const next = appendCompletion(
        actionMessages(
          actionMessages(messages, action.sourceId, { status: 'undone' }),
          messageId,
          { status: 'applied' },
        ),
        {
          key: `${messageId}:restored`,
          text: `Restored ${restoreText(action.entries)} in your tracker.`,
          sensitive: action.entries.some((entry) => entry.sensitive) || message.sensitive,
        },
      );
      await commitBulkRestore({ entries: action.entries, messages: next });
      setMessages(next);
      setEntries(await entryStorage.load());
    });
  }
  return {
    applyRestore,
    applyEntryAction: apply,
    cancelEntryAction: cancel,
    undoEntryAction: undo,
    applyBulkDelete: applyBulk,
    undoBulkDelete: undoBulk,
  };
}
