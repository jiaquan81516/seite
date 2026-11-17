import { entryActionSchema, hasBulkCriteria } from '../../shared/ai-schema';
import { formatDate, isValidDate } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { sortEntries } from '../lib/transactions';

// Removing this many (or more) entries needs the count typed back to confirm.
export const BULK_CONFIRM_THRESHOLD = 10;
// Larger matches are refused so every entry can actually be reviewed.
export const BULK_MAX_ENTRIES = 200;

export const EMPTY_FILTER_MESSAGE =
  'Tell me which entries to remove, such as a category, merchant or date range. To erase everything, use Your data → Delete local data.';

function cleanFilter(raw) {
  const filter = {
    category: raw?.category || null,
    method: raw?.method || null,
    merchant: raw?.merchant?.trim() || null,
    date_from: raw?.date_from || null,
    date_to: raw?.date_to || null,
  };
  if (!hasBulkCriteria(filter)) throw new Error(EMPTY_FILTER_MESSAGE);
  for (const key of ['date_from', 'date_to'])
    if (filter[key] && !isValidDate(filter[key]))
      throw new Error(
        'I couldn’t understand that date range. Try naming the dates again.',
      );
  if (filter.date_from && filter.date_to && filter.date_from > filter.date_to)
    throw new Error('The start date is after the end date. Ask again with the dates.');
  return filter;
}

export function matchesBulkFilter(entry, filter) {
  return (
    (!filter.category || entry.category === filter.category) &&
    (!filter.method || entry.method === filter.method) &&
    (!filter.merchant ||
      entry.merchant.toLowerCase().includes(filter.merchant.toLowerCase())) &&
    (!filter.date_from || entry.date >= filter.date_from) &&
    (!filter.date_to || entry.date <= filter.date_to)
  );
}

// The app, not the model, selects the records. The model only supplied a filter.
export function createBulkProposal(raw, entries) {
  const action = entryActionSchema.parse(raw);
  if (action.type !== 'bulk_delete') throw new Error('This is not a bulk removal.');
  const filter = cleanFilter(action.filter);
  const matches = sortEntries(
    entries.filter((entry) => matchesBulkFilter(entry, filter)),
  );
  if (!matches.length)
    throw new Error('No saved entries match that request, so nothing will be removed.');
  if (matches.length > BULK_MAX_ENTRIES)
    throw new Error(
      `That matches ${matches.length} entries. Narrow it, for example to a shorter date range, so you can review them. The limit is ${BULK_MAX_ENTRIES} at a time.`,
    );
  return { type: 'bulk_delete', filter, matches, removed: [], status: 'pending' };
}

export function describeFilter(filter) {
  const parts = [];
  if (filter.category) parts.push(filter.category);
  if (filter.method) parts.push(`paid with ${filter.method}`);
  if (filter.merchant) parts.push(`merchant contains “${filter.merchant}”`);
  if (filter.date_from && filter.date_to)
    parts.push(`${formatDate(filter.date_from)} to ${formatDate(filter.date_to)}`);
  else if (filter.date_from) parts.push(`from ${formatDate(filter.date_from)}`);
  else if (filter.date_to) parts.push(`up to ${formatDate(filter.date_to)}`);
  return parts.join(' · ');
}

export function needsTypedConfirmation(count) {
  return count >= BULK_CONFIRM_THRESHOLD;
}

export function bulkRemovalText(entries) {
  const total = entries.reduce((sum, entry) => sum + entry.amount_cents, 0);
  return `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} totalling ${formatMoney(total)}`;
}
