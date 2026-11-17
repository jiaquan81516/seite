import { describe, expect, it } from 'vitest';
import {
  addMonth,
  addToGoal,
  autoTickBills,
  billStatus,
  createBill,
  createGoal,
  createIncome,
  dueLabel,
  goalPercent,
  incomeBySource,
  limitStatus,
  nextOccurrence,
  setBillPaid,
} from '../src/lib/finance';
import { makeEntry } from './fixtures';

const NOW = '2026-11-17';
const bill = (overrides = {}) => ({
  id: 'b1',
  name: 'Singtel Mobile',
  amount_cents: 3900,
  due_date: '2026-11-20',
  kind: 'recurring',
  keywords: ['singtel'],
  paid: false,
  created_at: '2026-10-01T00:00:00Z',
  ...overrides,
});

describe('income', () => {
  it('validates and stores integer cents', () => {
    const income = createIncome({
      source: ' Salary ',
      amount: '1800.50',
      date: NOW,
      note: '',
    });
    expect(income).toMatchObject({ source: 'Salary', amount_cents: 180050, date: NOW });
    expect(() => createIncome({ source: '', amount: '5', date: NOW })).toThrow(
      'Enter where',
    );
    expect(() => createIncome({ source: 'x', amount: '-5', date: NOW })).toThrow();
    expect(() => createIncome({ source: 'x', amount: '5', date: 'nope' })).toThrow(
      'valid date',
    );
  });
  it('totals by source, largest first', () => {
    const rows = incomeBySource([
      { source: 'Tutoring', amount_cents: 100 },
      { source: 'Salary', amount_cents: 900 },
      { source: 'Tutoring', amount_cents: 150 },
    ]);
    expect(rows).toEqual([
      { source: 'Salary', amount: 900 },
      { source: 'Tutoring', amount: 250 },
    ]);
  });
});

describe('bills', () => {
  it('moves a due date by one month and clamps the day', () => {
    expect(addMonth('2026-01-31')).toBe('2026-02-28');
    expect(addMonth('2026-12-05')).toBe('2027-01-05');
  });
  it('allows an unknown amount and defaults keywords to the name', () => {
    const created = createBill({
      name: 'SP Services',
      amount: '',
      due_date: '2026-12-05',
      kind: 'recurring',
      keywords: '',
    });
    expect(created.amount_cents).toBeNull();
    expect(created.keywords).toEqual(['sp services']);
    expect(() =>
      createBill({
        name: 'x',
        amount: '',
        due_date: '2026-12-05',
        kind: 'weekly',
        keywords: '',
      }),
    ).toThrow('kind');
  });
  it('labels how close a bill is', () => {
    expect(billStatus(bill({ paid: true }), NOW)).toBe('Paid');
    expect(billStatus(bill({ due_date: '2026-11-12' }), NOW)).toBe('Overdue');
    expect(dueLabel(bill({ due_date: '2026-11-12' }), NOW)).toBe('Overdue by 5 days');
    expect(billStatus(bill({ due_date: NOW }), NOW)).toBe('Due today');
    expect(dueLabel(bill({ due_date: '2026-11-18' }), NOW)).toBe('Due tomorrow');
    expect(billStatus(bill(), NOW)).toBe('Due soon');
    expect(dueLabel(bill(), NOW)).toBe('Due in 3 days');
    expect(billStatus(bill({ due_date: '2026-12-20' }), NOW)).toBe('Upcoming');
  });
  it('ticks a bill only for the same merchant, exact amount and month', () => {
    const spend = (overrides) =>
      makeEntry({
        id: 's',
        merchant: 'Singtel Mobile',
        amount_cents: 3900,
        date: '2026-11-03',
        ...overrides,
      });
    expect(autoTickBills([bill()], [spend()], NOW)[0]).toMatchObject({
      paid: true,
      paid_via: 's',
    });
    expect(autoTickBills([bill()], [spend({ amount_cents: 3901 })], NOW)).toEqual([]);
    expect(autoTickBills([bill()], [spend({ merchant: 'Starbucks' })], NOW)).toEqual([]);
    expect(autoTickBills([bill()], [spend({ date: '2026-10-03' })], NOW)).toEqual([]);
    expect(autoTickBills([bill()], [spend({ date: '2026-11-25' })], NOW)).toEqual([]);
    expect(autoTickBills([bill()], [spend({ refunded: true })], NOW)).toEqual([]);
    expect(autoTickBills([bill({ amount_cents: null })], [spend()], NOW)).toEqual([]);
  });
  it('lets a manual tick or untick override the automatic match', () => {
    const spend = makeEntry({
      id: 's',
      merchant: 'Singtel',
      amount_cents: 3900,
      date: '2026-11-03',
    });
    const unticked = setBillPaid(bill({ paid: true, paid_via: 's' }), false);
    expect(unticked).toMatchObject({ paid: false, manual: true });
    expect(autoTickBills([unticked], [spend], NOW)).toEqual([]);
  });
  it('creates next month’s bill when a recurring one is paid', () => {
    const next = nextOccurrence(bill({ paid: true, paid_via: 's', manual: true }));
    expect(next).toMatchObject({
      due_date: '2026-12-20',
      paid: false,
      name: 'Singtel Mobile',
    });
    expect(next.id).not.toBe('b1');
    expect(next.paid_via).toBeUndefined();
  });
});

describe('goals and limits', () => {
  it('tracks savings progress', () => {
    const goal = createGoal({ name: 'Trip', target: '1000' });
    expect(goal.saved_cents).toBe(0);
    const saved = addToGoal(goal, 25000);
    expect(goalPercent(saved)).toBe(25);
    expect(goalPercent(addToGoal(goal, 200000))).toBe(100);
    expect(() => createGoal({ name: '', target: '10' })).toThrow('Name');
  });
  it('compares spending with a limit', () => {
    expect(limitStatus(2000, 10000)).toMatchObject({ state: 'under', remaining: 8000 });
    expect(limitStatus(8500, 10000).state).toBe('near');
    expect(limitStatus(12000, 10000)).toMatchObject({ state: 'over', remaining: -2000 });
  });
});
