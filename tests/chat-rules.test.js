import { beforeEach, describe, expect, it } from 'vitest';
import { buildChatContext, redactSensitiveText } from '../src/chat/context';
import { candidateToEntry, prepareCandidates } from '../src/chat/review';
import {
  correctSavedCategory,
  loadConversation,
  loadMerchantRules,
  markOriginalRefunded,
  saveReviewedEntries,
} from '../src/chat/storage';
import { entryStorage } from '../src/lib/storage';
import { createBackup, parseBackup } from '../src/lib/backups';
import { extractedSpend } from './ai-fixtures';
import { makeEntry } from './fixtures';
const fields = (overrides = {}) => ({
  merchant: 'Kopi & Toast',
  amount: '9.20',
  currency: 'SGD',
  date: '2026-11-16',
  time: '14:44',
  category: 'Food & Drink',
  method: 'Apple Pay',
  shareConfirmed: false,
  reviewConfirmed: false,
  ...overrides,
});
const candidate = (overrides = {}) =>
  prepareCandidates([{ ...extractedSpend, ...overrides }])[0];
beforeEach(async () => {
  await entryStorage.clear();
});
describe('reviewed extraction', () => {
  it('requires missing details and low-confidence review instead of guessing', () => {
    expect(() =>
      candidateToEntry(candidate({ confidence: 0.5 }), 'message', fields()),
    ).toThrow(/checked/);
    expect(() => candidateToEntry(candidate(), 'message', fields({ date: '' }))).toThrow(
      /date/,
    );
    expect(
      candidateToEntry(
        candidate({ confidence: 0.5 }),
        'message',
        fields({ reviewConfirmed: true }),
      ).amount_cents,
    ).toBe(920);
  });
  it('requires the personal share and rejects refunds and top-ups as spending', () => {
    const group = candidate({ needs_personal_share: true, amount: null });
    expect(() => candidateToEntry(group, 'message', fields())).toThrow(/own share/);
    expect(
      candidateToEntry(group, 'message', fields({ amount: '8.50', shareConfirmed: true }))
        .amount_cents,
    ).toBe(850);
    for (const kind of ['refund', 'transfer', 'income', 'paylater'])
      expect(() => candidateToEntry(candidate({ kind }), 'message', fields())).toThrow(
        /Only outgoing/,
      );
  });
  it('converts with a freshly checked rate and preserves the original audit fields', () => {
    const quote = {
      from: 'MYR',
      to: 'SGD',
      rate: 0.3152,
      date: '2026-11-16',
      checked_at: new Date().toISOString(),
    };
    const record = candidateToEntry(
      candidate(),
      'message',
      fields({ currency: 'MYR', amount: '3.20' }),
      quote,
    );
    expect(record.amount_cents).toBe(101);
    expect(record.original_amount_cents).toBe(320);
    expect(record.note).toContain('Rate date 2026-11-16');
    expect(parseBackup(createBackup([record]))).toEqual([record]);
    expect(() =>
      candidateToEntry(candidate(), 'message', fields({ currency: 'MYR' })),
    ).toThrow(/exchange rate/);
  });
  it('saves only reviewed selections, atomically including chat status, and is idempotent', async () => {
    const first = candidate();
    const second = candidate({ merchant: 'Ride', amount: 7.5 });
    const record = candidateToEntry(
      second,
      'message',
      fields({ merchant: 'Ride', amount: '7.50' }),
    );
    const history = [
      {
        id: 'message',
        role: 'assistant',
        text: 'Review',
        candidates: [
          { ...first, saved: false },
          { ...second, saved: true },
        ],
      },
    ];
    await saveReviewedEntries({ records: [record], messages: history });
    await saveReviewedEntries({
      records: [record],
      messages: history,
      allowDuplicateIds: [record.id],
    });
    expect(await entryStorage.load()).toEqual([record]);
    expect((await loadConversation())[0].candidates[0].saved).toBe(false);
  });
  it('blocks amount/date duplicates by default and allows an explicit override', async () => {
    await entryStorage.save(makeEntry({ date: '2026-11-16' }));
    const record = candidateToEntry(candidate(), 'message', fields());
    await expect(saveReviewedEntries({ records: [record] })).rejects.toThrow(
      /looks like/,
    );
    expect(await entryStorage.load()).toHaveLength(1);
    await saveReviewedEntries({ records: [record], allowDuplicateIds: [record.id] });
    expect(await entryStorage.load()).toHaveLength(2);
  });
  it('marks the original refunded without adding an expense and keeps the flag in backups', async () => {
    await entryStorage.save(makeEntry());
    await markOriginalRefunded('cafe', []);
    const entries = await entryStorage.load();
    expect(entries).toHaveLength(1);
    expect(entries[0].refunded).toBe(true);
    expect(
      buildChatContext(entries, [], '2026-11-17').facts.find(
        (fact) => fact.id === 'Day:total',
      ).text,
    ).toContain('S$0.00');
    expect(parseBackup(createBackup(entries))).toEqual(entries);
  });
  it('learns merchant categories from confirmed corrections', async () => {
    await entryStorage.save(makeEntry({ merchant: 'Kopi & Toast' }));
    await correctSavedCategory('cafe', 'Groceries');
    const rules = await loadMerchantRules();
    expect(
      prepareCandidates([{ ...extractedSpend, merchant: 'KOPI & TOAST' }], rules)[0]
        .category,
    ).toBe('Groceries');
    expect((await entryStorage.load())[0].category).toBe('Groceries');
    await entryStorage.clear();
    expect(await loadMerchantRules()).toEqual([]);
    expect(await loadConversation()).toEqual([]);
  });
});
describe('compact context and redaction', () => {
  it('preserves receipt dates while filtering account-like digit sequences', () => {
    expect(redactSensitiveText('On 2026-11-16 card 1234 5678 9012 3456')).toBe(
      'On 2026-11-16 card [number removed]',
    );
  });
  it('sends bounded summaries and recent entries, without notes', () => {
    const entries = Array.from({ length: 100 }, (_, index) =>
      makeEntry({ id: String(index), note: 'private note' }),
    );
    const context = buildChatContext(entries, [], '2026-11-17');
    expect(context.request.recent).toHaveLength(12);
    expect(JSON.stringify(context.request)).not.toContain('private note');
    expect(
      context.facts.find((fact) => fact.id === 'Week:category:Food & Drink').text,
    ).toContain('S$920.00');
  });
});

describe('wider spending facts', () => {
  it('adds earlier periods and top merchants calculated by the app', () => {
    const entries = [
      makeEntry({ id: 'y', date: '2026-11-16', amount_cents: 300, merchant: 'Bus' }),
      makeEntry({ id: 't', date: '2026-11-17', amount_cents: 900, merchant: 'Kopi' }),
      makeEntry({ id: 'o', date: '2026-10-05', amount_cents: 1000, merchant: 'Kopi' }),
    ];
    const facts = buildChatContext(entries, [], '2026-11-17').facts;
    const text = (id) => facts.find((fact) => fact.id === id).text;
    expect(text('prev:Day:total')).toContain('S$3.00 yesterday');
    expect(text('prev:Month:total')).toContain('S$10.00 last month');
    expect(text('Month:merchants')).toContain('Kopi (S$9.00), Bus (S$3.00)');
    expect(facts.length).toBeLessThanOrEqual(100);
  });
});

describe('daily average facts', () => {
  it('divides by days so far this month and by every day of last month', () => {
    const entries = [
      makeEntry({ id: 'a', date: '2026-11-02', amount_cents: 1000 }),
      makeEntry({ id: 'b', date: '2026-11-17', amount_cents: 700 }),
      makeEntry({ id: 'c', date: '2026-10-05', amount_cents: 3100 }),
      makeEntry({ id: 'r', date: '2026-11-03', amount_cents: 9999, refunded: true }),
    ];
    const facts = buildChatContext(entries, [], '2026-11-17').facts;
    const text = (id) => facts.find((fact) => fact.id === id).text;
    expect(text('Month:average')).toContain('S$1.00 (S$17.00 over 17 days so far)');
    expect(text('prev:Month:average')).toContain('S$1.00 (S$31.00 over 31 days)');
    expect(text('Week:average')).toContain('over 2 days so far');
    expect(facts.length).toBeLessThanOrEqual(100);
  });
});
