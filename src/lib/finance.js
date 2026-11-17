import { isValidDate, periodRange, shiftDays, today } from './dates';
import { parseAmount } from './money';

export const BILL_KINDS = ['recurring', 'instalment', 'one-off'];
export const LIMIT_PERIODS = ['Day', 'Week', 'Month'];
export const PLAN_KEY = 'seite-plan';

const text = (value) => String(value ?? '').trim();

// ---------- Income ----------
export function createIncome(fields, existing) {
  const source = text(fields.source);
  if (!source) throw new Error('Enter where the money came from.');
  if (!isValidDate(fields.date)) throw new Error('Choose a valid date.');
  return {
    ...existing,
    id: existing?.id ?? crypto.randomUUID(),
    date: fields.date,
    source,
    amount_cents: parseAmount(fields.amount),
    note: text(fields.note),
    created_at: existing?.created_at ?? new Date().toISOString(),
  };
}
export function filterIncome(income, filters) {
  const [start, end] = periodRange(filters.date, filters.period);
  return income.filter((item) => item.date >= start && item.date <= end);
}
export const totalIncome = (income) =>
  income.reduce((sum, item) => sum + item.amount_cents, 0);
export function incomeBySource(income) {
  const totals = new Map();
  for (const item of income)
    totals.set(item.source, (totals.get(item.source) ?? 0) + item.amount_cents);
  return [...totals]
    .map(([source, amount]) => ({ source, amount }))
    .sort((a, b) => b.amount - a.amount);
}
export const sortIncome = (income) =>
  [...income].sort(
    (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
  );

// ---------- Bills ----------
export function addMonth(date) {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(Date.UTC(year, month, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const next = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, last)),
  );
  return next.toISOString().slice(0, 10);
}
export function createBill(fields, existing) {
  const name = text(fields.name);
  if (!name) throw new Error('Enter a name for the bill.');
  if (!isValidDate(fields.due_date)) throw new Error('Choose a valid due date.');
  if (!BILL_KINDS.includes(fields.kind))
    throw new Error('Choose what kind of bill it is.');
  const amount = text(fields.amount);
  const keywords = text(fields.keywords)
    .split(',')
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);
  return {
    ...existing,
    id: existing?.id ?? crypto.randomUUID(),
    name,
    amount_cents: amount ? parseAmount(amount) : null,
    due_date: fields.due_date,
    kind: fields.kind,
    keywords: keywords.length ? keywords : [name.toLowerCase()],
    paid: existing?.paid ?? false,
    ...(existing?.paid_via ? { paid_via: existing.paid_via } : {}),
    ...(existing?.manual ? { manual: true } : {}),
    created_at: existing?.created_at ?? new Date().toISOString(),
  };
}
function daysBetween(from, to) {
  return Math.round(
    (new Date(`${to}T12:00:00Z`) - new Date(`${from}T12:00:00Z`)) / 86400000,
  );
}
export function billStatus(bill, now = today()) {
  if (bill.paid) return 'Paid';
  const days = daysBetween(now, bill.due_date);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days <= 7) return 'Due soon';
  return 'Upcoming';
}
export function dueLabel(bill, now = today()) {
  if (bill.paid) return 'Paid';
  const days = daysBetween(now, bill.due_date);
  if (days < -1) return `Overdue by ${-days} days`;
  if (days === -1) return 'Overdue by 1 day';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 7) return `Due in ${days} days`;
  return `Due in ${days} days`;
}
export const billsInMonth = (bills, month) =>
  bills
    .filter((bill) => bill.due_date.startsWith(month))
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.name.localeCompare(b.name));
export function matchBill(bill, entries, now = today()) {
  if (bill.amount_cents == null) return null;
  const month = bill.due_date.slice(0, 7);
  return (
    entries.find(
      (entry) =>
        !entry.refunded &&
        entry.date <= now &&
        entry.date.startsWith(month) &&
        entry.amount_cents === bill.amount_cents &&
        bill.keywords.some((word) => entry.merchant.toLowerCase().includes(word)),
    ) ?? null
  );
}
// A saved transaction with the right merchant and the exact amount marks the bill
// Paid, unless the person has already ticked or unticked it by hand.
export function autoTickBills(bills, entries, now = today()) {
  const changed = [];
  for (const bill of bills) {
    if (bill.paid || bill.manual) continue;
    const match = matchBill(bill, entries, now);
    if (match) changed.push({ ...bill, paid: true, paid_via: match.id });
  }
  return changed;
}
export function nextOccurrence(bill) {
  const { paid_via: _via, manual: _manual, ...rest } = bill;
  return {
    ...rest,
    id: crypto.randomUUID(),
    due_date: addMonth(bill.due_date),
    paid: false,
    created_at: new Date().toISOString(),
  };
}
export function setBillPaid(bill, paid) {
  const { paid_via: _via, ...rest } = bill;
  return { ...rest, paid, manual: true };
}

// ---------- Goals and limits ----------
export function createGoal(fields, existing) {
  const name = text(fields.name);
  if (!name) throw new Error('Name your goal.');
  return {
    ...existing,
    id: existing?.id ?? crypto.randomUUID(),
    name,
    target_cents: parseAmount(fields.target),
    saved_cents: existing?.saved_cents ?? 0,
    created_at: existing?.created_at ?? new Date().toISOString(),
  };
}
export const addToGoal = (goal, cents) => ({
  ...goal,
  saved_cents: Math.max(0, goal.saved_cents + cents),
});
export const goalPercent = (goal) =>
  Math.min(100, Math.round((goal.saved_cents / goal.target_cents) * 100));

export function loadPlan() {
  const empty = { Day: null, Week: null, Month: null };
  try {
    const saved = JSON.parse(localStorage.getItem(PLAN_KEY) ?? '{}');
    for (const period of LIMIT_PERIODS)
      empty[period] =
        Number.isSafeInteger(saved.limits?.[period]) && saved.limits[period] > 0
          ? saved.limits[period]
          : null;
  } catch {
    /* Unreadable plan: start with no limits. */
  }
  return empty;
}
export function savePlan(limits) {
  localStorage.setItem(PLAN_KEY, JSON.stringify({ limits }));
}
export function limitStatus(spent, limit) {
  const percent = Math.round((spent / limit) * 100);
  return {
    percent,
    remaining: limit - spent,
    state: spent > limit ? 'over' : percent >= 80 ? 'near' : 'under',
  };
}
export { shiftDays };
