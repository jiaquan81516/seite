export async function getExchangeRate(from, fetchImpl = fetch) {
  if (!/^[A-Z]{3}$/.test(from)) throw new Error('Choose a three-letter currency code.');
  if (from === 'SGD')
    return { from, to: 'SGD', rate: 1, date: new Date().toISOString().slice(0, 10) };
  const response = await fetchImpl(
    `https://api.frankfurter.dev/v1/latest?base=${from}&symbols=SGD`,
    { signal: AbortSignal.timeout(10000) },
  );
  if (!response.ok)
    throw new Error(
      'A live exchange rate is unavailable for this currency. Try again later; no rate will be guessed.',
    );
  const result = await response.json();
  const rate = result.rates?.SGD;
  if (!Number.isFinite(rate) || rate <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(result.date))
    throw new Error('The exchange-rate response could not be verified.');
  return {
    from,
    to: 'SGD',
    rate,
    date: result.date,
    checked_at: new Date().toISOString(),
  };
}
