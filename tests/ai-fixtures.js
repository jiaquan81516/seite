export const extractedSpend = {
  merchant: 'Kopi & Toast',
  amount: 9.2,
  currency: 'SGD',
  date: '2026-11-16',
  time: '14:44',
  payment_method: 'Apple Pay',
  category: 'Food & Drink',
  confidence: 0.95,
  notes: '',
  kind: 'expense',
  needs_personal_share: false,
};
export function aiReply(overrides = {}) {
  return {
    kind: 'extraction',
    reply: 'Check these details before saving.',
    transactions: [extractedSpend],
    answer_fact_id: null,
    correction: null,
    ...overrides,
  };
}
export function chatRequest(overrides = {}) {
  return {
    text: 'Read this receipt.',
    mode: 'cloud',
    sensitive: false,
    cloudConsent: true,
    allowFallback: true,
    image: null,
    history: [],
    context: { today: '2026-11-17', facts: [], recent: [], candidates: [] },
    ...overrides,
  };
}
