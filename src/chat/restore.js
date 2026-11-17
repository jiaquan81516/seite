import { bulkRemovalText } from './bulk-delete';

// "add back the deleted data", "restore the removed entries", "undo the removal".
// A restore word is required so "undo the latest spend" stays a removal request.
export function isRestoreRequest(text) {
  const question = text
    .toLowerCase()
    .trim()
    .replace(/[?!.]+$/, '')
    .replace(/\s+/g, ' ');
  return /^(?:please )?(?:(?:add|put|bring|get) (?:back|it back|them back)|restore|recover|undo)(?: (?:the|my|those|that|these|it|them))*(?: (?:back|deleted|removed|last deleted|last removed|just deleted|just removed|recently deleted|recently removed))*(?: (?:data|entries|entry|spends?|spendings?|expenses?|logs?|transactions?|removal|deletion|stuff))?(?: back)?(?: please)?$/.test(
    question,
  )
    ? /\b(back|deleted|removed|removal|deletion|restore|recover)\b/.test(question)
    : false;
}

// The newest removal in this chat that has not already been undone.
export function findRestorable(messages) {
  for (const message of [...messages].reverse()) {
    const action = message.action;
    if (action?.status !== 'applied') continue;
    if (action.type === 'bulk_delete' && action.removed?.length)
      return { sourceId: message.id, entries: action.removed };
    if (action.type === 'delete' && action.before)
      return { sourceId: message.id, entries: [action.before] };
  }
  return null;
}

export function createRestoreProposal(restorable) {
  return {
    type: 'restore',
    sourceId: restorable.sourceId,
    entries: restorable.entries,
    status: 'pending',
  };
}

export const restoreText = (entries) => bulkRemovalText(entries);
