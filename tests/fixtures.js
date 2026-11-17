export function makeEntry(overrides = {}) {
  return {
    id: 'cafe',
    merchant: 'Test cafe',
    amount_cents: 920,
    date: '2026-11-17',
    time: '14:44',
    category: 'Food & Drink',
    method: 'Apple Pay',
    source: 'manual',
    currency: 'SGD',
    note: 'Personal share',
    created_at: '2026-11-17T06:44:00Z',
    ...overrides,
  };
}
export const defaultFilters = {
  date: '2026-11-17',
  period: 'Day',
  category: '',
  method: '',
  search: '',
  day: '',
};
export const formFields = {
  merchant: 'Test cafe',
  amount: '9.20',
  date: '2026-11-17',
  time: '14:44',
  category: 'Food & Drink',
  method: 'Apple Pay',
  note: 'Personal share',
};
