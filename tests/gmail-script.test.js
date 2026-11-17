import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, PAYMENT_METHODS } from '../src/lib/config';

// Apps Script's plain JavaScript is loaded without Google's services so the
// masking and validation rules that protect the user can be tested here.
const source = readFileSync(resolve(process.cwd(), 'gmail-sync/Code.gs'), 'utf8');
const script = runInNewContext(
  `${source}\n({ redactEmailText, normalizeItem, buildPrompt, isValidDateString, CATEGORIES, PAYMENT_METHODS })`,
  {},
);
const meta = {
  id: 'abc123def456',
  receivedAt: '2026-11-17T10:00:00.000Z',
  receivedDate: '2026-11-17',
};
const good = {
  is_transaction: true,
  kind: 'expense',
  merchant: 'Grab',
  amount: 12.5,
  currency: 'SGD',
  date: '2026-11-16',
  time: '18:30',
  category: 'Transport',
  payment_method: 'PayLah',
  confidence: 0.92,
};

describe('Gmail script privacy masking', () => {
  it('masks card and account numbers, emails and phone numbers', () => {
    const text = script.redactEmailText(
      'Card 4111 1111 1111 1234 charged SGD 12.50. Contact me at jane@example.com or +65 9123 4567.',
    );
    expect(text).not.toContain('4111');
    expect(text).not.toContain('jane@example.com');
    expect(text).not.toContain('9123 4567');
    expect(text).toContain('[number ending 1234]');
    expect(text).toContain('SGD 12.50');
  });
  it('limits how much of an email is sent', () => {
    expect(script.redactEmailText('a'.repeat(10000)).length).toBeLessThanOrEqual(3000);
  });
});

describe('Gmail script validation of model output', () => {
  it('accepts a complete transaction', () => {
    expect(script.normalizeItem(good, meta)).toMatchObject({
      id: 'abc123def456',
      merchant: 'Grab',
      amount: 12.5,
      currency: 'SGD',
      date: '2026-11-16',
      payment_method: 'PayLah',
      confidence: 0.92,
    });
  });
  it.each([
    ['not a transaction', { is_transaction: false }],
    ['a zero amount', { amount: 0 }],
    ['a negative amount', { amount: -3 }],
    ['an absurd amount', { amount: 1e12 }],
    ['no merchant', { merchant: '  ' }],
    ['a bad currency', { currency: 'sgd' }],
  ])('drops %s', (_, change) => {
    expect(script.normalizeItem({ ...good, ...change }, meta)).toBeNull();
  });
  it('falls back safely for unknown categories, methods and kinds', () => {
    const item = script.normalizeItem(
      { ...good, category: 'Gambling', payment_method: 'Bitcoin', kind: 'gift' },
      meta,
    );
    expect(item.category).toBe('Other');
    expect(item.payment_method).toBeNull();
    expect(item.kind).toBe('unknown');
  });
  it('uses the email date but lowers confidence when the model gave no valid date', () => {
    const item = script.normalizeItem(
      { ...good, date: '2026-02-31', confidence: 0.95 },
      meta,
    );
    expect(item.date).toBe('2026-11-17');
    expect(item.confidence).toBeLessThanOrEqual(0.6);
  });
  it('keeps its category and payment lists in step with the app', () => {
    expect(Array.from(script.CATEGORIES)).toEqual(CATEGORIES);
    expect(Array.from(script.PAYMENT_METHODS)).toEqual(PAYMENT_METHODS);
  });
  it('tells the model the email is untrusted data', () => {
    expect(script.buildPrompt('bank@x.com', 'hello', '2026-11-17')).toMatch(
      /untrusted data/,
    );
  });
});
