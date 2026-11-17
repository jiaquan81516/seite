import { describe, expect, it } from 'vitest';
import {
  averageFactId,
  dateSpendingFact,
  spendingFactId,
  spendingQuestionDate,
} from '../src/chat/local-answer';
import { makeEntry } from './fixtures';

describe('local spending questions', () => {
  it.each([
    ['how much did spend today', 'Day:total'],
    ['How much did I spend today?', 'Day:total'],
    ['How much have I spent this month?', 'Month:total'],
    ['How much this week?', 'Week:total'],
    ["What's my total spending today?", 'Day:total'],
    ['How much did I spend on food this week?', 'Week:category:Food & Drink'],
    ['How much did I spend on groceries today?', 'Day:category:Groceries'],
  ])('matches %s', (question, expected) => {
    expect(spendingFactId(question)).toBe(expected);
  });
  it.each([
    'Add my spending today',
    'How much did I spend yesterday?',
    'How much did I spend on rent today?',
    'How much did I spend today compared to yesterday?',
    'How much did we spend today?',
    'How much did I spend today? Add $50 too.',
  ])('leaves ambiguous or unsupported requests to AI: %s', (question) => {
    expect(spendingFactId(question)).toBeNull();
  });
});

describe('spending questions about a specific day', () => {
  const today = '2026-11-17';
  it.each([
    ['2 nov spendings', '2026-11-02'],
    ['show me second november spendings', '2026-11-02'],
    ['Show me 2nd Nov spending', '2026-11-02'],
    ['what did I spend on november 2', '2026-11-02'],
    ['how much did I spend on 2 November 2025', '2025-11-02'],
    ['show me yesterday spendings', '2026-11-16'],
    ['show me 25 dec spendings', '2025-12-25'],
  ])('resolves %s', (question, expected) => {
    expect(spendingQuestionDate(question, today)).toBe(expected);
  });
  it.each([
    '2 nov',
    'show me 31 feb spendings',
    'add 2 nov spendings',
    'show me 2 nov and 3 nov spendings',
    'delete 2 nov spendings',
  ])('does not guess for %s', (question) => {
    expect(spendingQuestionDate(question, today)).toBeNull();
  });
  it('totals the day from saved entries and links to that day', () => {
    const fact = dateSpendingFact(
      'show me second november spendings',
      [
        makeEntry({ id: 'a', date: '2026-11-02', amount_cents: 500 }),
        makeEntry({ id: 'b', date: '2026-11-02', amount_cents: 250, merchant: 'Bus' }),
        makeEntry({ id: 'c', date: '2026-11-03', amount_cents: 999 }),
      ],
      today,
    );
    expect(fact.text).toContain('S$7.50');
    expect(fact.text).toContain('2 entries');
    expect(fact.view).toMatchObject({ date: '2026-11-02', period: 'Day' });
  });
  it('says plainly when nothing was saved that day', () => {
    expect(dateSpendingFact('2 nov spendings', [], today).text).toMatch(
      /no saved spends/,
    );
  });
});

describe('daily average questions', () => {
  it.each([
    ['how much i spent this month daily average?', 'Month:average'],
    ['daily average this month', 'Month:average'],
    ["What's my average spending per day?", 'Month:average'],
    ['average per day this week', 'Week:average'],
    ['daily average last month', 'prev:Month:average'],
    ['avg daily spend last week', 'prev:Week:average'],
  ])('maps %s', (question, expected) => {
    expect(averageFactId(question)).toBe(expected);
  });
  it.each([
    'average spending on food per day',
    'average per entry this month',
    'compare my daily average to last month',
    'add average',
    'how much did I spend today',
  ])('leaves %s to the AI', (question) => {
    expect(averageFactId(question)).toBeNull();
  });
});
