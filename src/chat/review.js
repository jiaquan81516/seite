import { CATEGORIES, PAYMENT_METHODS } from '../lib/config';
import { isValidDate, normalizeTime } from '../lib/dates';
import { parseAmount } from '../lib/money';
import { merchantKey } from './storage';

export function prepareCandidates(transactions, rules = []) {
  const ruleMap = new Map(rules.map((rule) => [rule.merchant, rule.category]));
  return transactions.map((transaction) => ({
    ...transaction,
    id: crypto.randomUUID(),
    originalCategory: transaction.category,
    category: transaction.merchant
      ? ruleMap.get(merchantKey(transaction.merchant)) || transaction.category
      : transaction.category,
    selected:
      transaction.kind === 'expense' &&
      transaction.confidence >= 0.7 &&
      !transaction.needs_personal_share,
    saved: false,
  }));
}

export function candidateToEntry(candidate, messageId, fields, fx) {
  const merchant = fields.merchant.trim();
  const originalCents = parseAmount(fields.amount);
  const currency = fields.currency.trim().toUpperCase();
  if (!merchant || merchant.length > 160) throw new Error('Fill in a readable merchant.');
  if (!isValidDate(fields.date)) throw new Error('Fill in the transaction date.');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Fill in the three-letter currency.');
  if (!CATEGORIES.includes(fields.category) || !PAYMENT_METHODS.includes(fields.method))
    throw new Error('Choose a category and payment method.');
  const time = normalizeTime(fields.time);
  if (String(fields.time ?? '').trim() && !time) throw new Error('Choose a valid time.');
  if (candidate.kind !== 'expense')
    throw new Error('Only outgoing expenses can be saved here.');
  if (candidate.needs_personal_share && !fields.shareConfirmed)
    throw new Error('Confirm that this is your own share.');
  if (candidate.confidence < 0.7 && !fields.reviewConfirmed)
    throw new Error('Confirm you checked the unclear fields.');
  let amountCents = originalCents;
  let note = candidate.notes || '';
  const converted = currency !== 'SGD';
  if (converted) {
    if (
      fx?.from !== currency ||
      fx?.to !== 'SGD' ||
      !Number.isFinite(fx.rate) ||
      fx.rate <= 0
    )
      throw new Error('Get a live exchange rate before saving.');
    if (!fx.checked_at || Date.now() - Date.parse(fx.checked_at) > 300_000)
      throw new Error(
        'Refresh the exchange rate, review the converted amount, then save again.',
      );
    amountCents = Math.round(originalCents * fx.rate);
    note = `${note}${note ? '\n' : ''}${currency} ${(originalCents / 100).toFixed(2)} converted at 1 ${currency} = SGD ${fx.rate}. Rate date ${fx.date}; checked ${fx.checked_at}.`;
  }
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0)
    throw new Error('This amount cannot be stored accurately in cents.');
  return {
    id: candidate.id,
    merchant,
    amount_cents: amountCents,
    date: fields.date,
    time,
    category: fields.category,
    method: fields.method,
    currency,
    note,
    source: candidate.gmailId ? 'gmail_import' : 'ai_chat',
    ...(candidate.sensitive ? { sensitive: true } : {}),
    // Gmail imports use the email's own ID so the same email is never added twice.
    external_ref: candidate.gmailId
      ? `gmail-${candidate.gmailId}`
      : `ai-chat-${messageId}-${candidate.id}`,
    created_at: new Date().toISOString(),
    ...(converted
      ? { original_amount_cents: originalCents, fx_rate: fx.rate, fx_date: fx.date }
      : {}),
  };
}

export function duplicateFor(entries, date, amountCents) {
  return entries.find(
    (entry) => entry.date === date && entry.amount_cents === amountCents,
  );
}
