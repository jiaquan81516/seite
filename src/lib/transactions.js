import { CATEGORIES, PAYMENT_METHODS } from './config';
import { isValidDate, normalizeTime, periodRange } from './dates';
import { parseAmount } from './money';
export function filterEntries(
  entries,
  filters,
  { ignoreCategory = false, ignoreDay = false } = {},
) {
  const [start, end] = periodRange(filters.date, filters.period);
  return entries.filter(
    (entry) =>
      (!filters.excludeSensitive || !entry.sensitive) &&
      entry.date >= start &&
      entry.date <= end &&
      (!filters.category || ignoreCategory || entry.category === filters.category) &&
      (!filters.method || entry.method === filters.method) &&
      (!filters.day || ignoreDay || entry.date === filters.day) &&
      entry.merchant.toLowerCase().includes(filters.search.toLowerCase()),
  );
}
export function createEntry(fields, existing) {
  const merchant = fields.merchant.trim();
  if (!merchant) throw new Error('Enter a merchant.');
  if (!isValidDate(fields.date)) throw new Error('Choose a valid date.');
  if (!CATEGORIES.includes(fields.category) || !PAYMENT_METHODS.includes(fields.method)) {
    throw new Error('Choose a category and payment method.');
  }
  const time = normalizeTime(fields.time);
  if (String(fields.time ?? '').trim() && !time) {
    throw new Error('Choose a valid time.');
  }
  return {
    ...existing,
    id: existing?.id ?? crypto.randomUUID(),
    merchant,
    amount_cents: parseAmount(fields.amount),
    date: fields.date,
    time,
    category: fields.category,
    method: fields.method,
    note: fields.note.trim(),
    ...(existing
      ? { refunded: fields.refunded === 'on' || fields.refunded === true }
      : {}),
    currency: existing?.currency ?? 'SGD',
    source: existing?.source ?? 'manual',
    created_at: existing?.created_at ?? new Date().toISOString(),
  };
}
export function sortEntries(entries) {
  return [...entries].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.time || '').localeCompare(a.time || '') ||
      b.created_at.localeCompare(a.created_at),
  );
}
