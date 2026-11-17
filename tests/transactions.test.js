import { describe, expect, it } from 'vitest';
import { createEntry, filterEntries } from '../src/lib/transactions';
import { totalAmount } from '../src/lib/money';
import { defaultFilters, formFields, makeEntry } from './fixtures';
const entries = [
  makeEntry({ amount_cents: 10 }),
  makeEntry({
    id: 'shop',
    merchant: 'Shop',
    amount_cents: 20,
    category: 'Groceries',
    method: 'Card',
  }),
  makeEntry({ id: 'monday', date: '2026-11-16' }),
  makeEntry({ id: 'sunday', date: '2026-11-15', amount_cents: 100 }),
  makeEntry({ id: 'october', date: '2026-10-31', amount_cents: 1000 }),
];
describe('entry filtering', () => {
  it.each([
    ['Day', 30],
    ['Week', 950],
    ['Month', 1050],
  ])('calculates the %s total', (period, expected) => {
    expect(totalAmount(filterEntries(entries, { ...defaultFilters, period }))).toBe(
      expected,
    );
  });
  it.each([
    [{ category: 'Groceries' }, 20],
    [{ method: 'Apple Pay' }, 10],
    [{ search: 'SHOP' }, 20],
    [{ period: 'Month', day: '2026-11-16' }, 920],
  ])('applies filters %j', (changes, expected) => {
    expect(totalAmount(filterEntries(entries, { ...defaultFilters, ...changes }))).toBe(
      expected,
    );
  });
  it('keeps other filters when preparing the category chart', () => {
    expect(
      filterEntries(
        entries,
        { ...defaultFilters, category: 'Groceries', method: 'Apple Pay' },
        { ignoreCategory: true },
      ),
    ).toHaveLength(1);
  });
});
describe('entry creation and editing', () => {
  it('stores integer cents and preserves record identity on edits', () => {
    const existing = makeEntry();
    const edited = createEntry({ ...formFields, amount: '10.10' }, existing);
    expect(edited).toMatchObject({
      id: existing.id,
      created_at: existing.created_at,
      amount_cents: 1010,
    });
  });
  it.each([
    { merchant: ' ' },
    { time: '25:00' },
    { date: '2026-02-30' },
    { category: 'Unknown' },
  ])('rejects invalid fields %j', (changes) => {
    expect(() => createEntry({ ...formFields, ...changes })).toThrow();
  });
});
