import { entryActionSchema } from '../../shared/ai-schema';
import { createEntry } from '../lib/transactions';

export function isRecentRemoval(text) {
  return /^(?:please )?(?:remove|delete|undo) (?:the |my )?(?:recently added|last added|most recently added|latest|last|most recent) (?:log|entry|spend|expense|transaction)(?: please)?[.!?]*$/i.test(
    text.trim(),
  );
}

export function newestEntries(entries) {
  return [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function recentRemoval(entries) {
  const recent = newestEntries(entries);
  if (!recent.length) return null;
  // Multiple entries may have been saved together. Ask rather than choose by ID.
  const latest = recent.filter((entry) => entry.created_at === recent[0].created_at);
  return createActionProposal(
    {
      type: 'delete',
      target_id: latest.length === 1 ? latest[0].id : null,
      changes: null,
    },
    latest,
  );
}

export function createActionProposal(raw, entries) {
  const action = entryActionSchema.parse(raw);
  const options = newestEntries(entries).slice(0, 12);
  if (!options.length) throw new Error('There are no saved entries to change.');
  if (action.target_id && !options.some((entry) => entry.id === action.target_id))
    throw new Error(
      'That entry is no longer available. Ask again using its merchant and date.',
    );
  const changes = Object.fromEntries(
    Object.entries(action.changes || {}).filter(([, value]) => value !== null),
  );
  if (action.type === 'update' && !Object.keys(changes).length)
    throw new Error('Tell me what you’d like to change on that entry.');
  return {
    type: action.type,
    targetId: action.target_id || '',
    changes,
    options,
    status: 'pending',
  };
}

export function updatedEntry(entry, changes) {
  if (changes.amount_cents !== undefined && entry.currency !== 'SGD')
    throw new Error(
      'Use the tracker to edit a foreign-currency amount so its conversion can be reviewed.',
    );
  const next = { ...entry, ...changes };
  return createEntry(
    {
      merchant: next.merchant,
      amount: (next.amount_cents / 100).toFixed(2),
      date: next.date,
      time: next.time || '',
      category: next.category,
      method: next.method,
      note: next.note || '',
      refunded: next.refunded,
    },
    entry,
  );
}

export function actionMessages(messages, messageId, changes) {
  return messages.map((message) =>
    message.id === messageId
      ? { ...message, action: { ...message.action, ...changes } }
      : message,
  );
}
