import { gmailItemSchema } from '../../shared/gmail-item';
import { isValidDate } from '../lib/dates';
import { duplicateFor } from '../chat/review';
import { isDemoId } from './demo';

// Saved straight away only when every field is clear. Anything else is shown
// for review, using the same card as receipt scans.
export const AUTO_CONFIDENCE = 0.85;

export const gmailRef = (id) => `gmail-${id}`;

function itemToEntry(item) {
  return {
    id: gmailRef(item.id),
    merchant: item.merchant,
    amount_cents: Math.round(item.amount * 100),
    date: item.date,
    time: item.time || '',
    category: item.category,
    method: item.payment_method,
    currency: 'SGD',
    note: isDemoId(item.id) ? 'Imported from Gmail (demo data)' : 'Imported from Gmail',
    source: 'gmail_import',
    external_ref: gmailRef(item.id),
    created_at: new Date().toISOString(),
  };
}

function itemToCandidate(item) {
  return {
    merchant: item.merchant,
    amount: item.amount,
    currency: item.currency,
    date: item.date,
    time: item.time || null,
    payment_method: item.payment_method,
    category: item.category,
    confidence: item.confidence,
    notes: isDemoId(item.id) ? 'From Gmail (demo data)' : 'From Gmail',
    kind: 'expense',
    needs_personal_share: false,
    gmailId: item.id,
  };
}

// Decide what to do with each queued email. Pure: no storage, no network.
export function planGmailImport(rawItems, entries, messages) {
  const known = new Set(entries.map((entry) => entry.external_ref).filter(Boolean));
  const queued = new Set(
    messages.flatMap((message) =>
      (message.candidates || []).map((candidate) => candidate.gmailId).filter(Boolean),
    ),
  );
  const plan = {
    auto: [],
    review: [],
    ackIds: [],
    skipped: { duplicate: 0, notExpense: 0, invalid: 0 },
  };
  const seen = new Set();
  for (const raw of rawItems) {
    const parsed = gmailItemSchema.safeParse(raw);
    const id = parsed.success ? parsed.data.id : String(raw?.id ?? '');
    if (/^[A-Za-z0-9]+$/.test(id)) plan.ackIds.push(id);
    if (!parsed.success || !isValidDate(parsed.data.date)) {
      plan.skipped.invalid += 1;
      continue;
    }
    const item = parsed.data;
    if (seen.has(item.id) || known.has(gmailRef(item.id)) || queued.has(item.id)) {
      plan.skipped.duplicate += 1;
      continue;
    }
    seen.add(item.id);
    if (item.kind !== 'expense') {
      plan.skipped.notExpense += 1;
      continue;
    }
    const cents = Math.round(item.amount * 100);
    const sameAmountDay = duplicateFor([...entries, ...plan.auto], item.date, cents);
    const clear =
      item.confidence >= AUTO_CONFIDENCE &&
      item.currency === 'SGD' &&
      // "Other" means the email didn't say how it was paid, so ask.
      Boolean(item.payment_method) &&
      item.payment_method !== 'Other' &&
      !sameAmountDay;
    if (clear) plan.auto.push(itemToEntry(item));
    else plan.review.push(itemToCandidate(item));
  }
  return plan;
}
