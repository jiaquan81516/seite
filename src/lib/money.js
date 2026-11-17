const currencyFormatter = new Intl.NumberFormat('en-SG', {
  style: 'currency',
  currency: 'SGD',
  currencyDisplay: 'narrowSymbol',
});
export function formatMoney(cents) {
  return currencyFormatter.format(cents / 100).replace(/^\$/, 'S$');
}
export function parseAmount(value) {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error('Enter a positive amount with up to two decimal places.');
  }
  // Parse the decimal digits directly to avoid floating-point rounding.
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error('Enter a valid positive amount.');
  }
  return cents;
}
export function totalAmount(entries) {
  return entries.reduce(
    (sum, entry) => sum + (entry.refunded ? 0 : entry.amount_cents),
    0,
  );
}
