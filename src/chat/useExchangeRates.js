import { useEffect, useState } from 'react';
import { fetchExchangeRate } from './api';
export function useExchangeRates(currencies) {
  const [quotes, setQuotes] = useState({});
  const key = [...new Set(currencies)]
    .filter((currency) => /^[A-Z]{3}$/.test(currency) && currency !== 'SGD')
    .sort()
    .join(',');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    for (const currency of key.split(',').filter(Boolean)) {
      setQuotes((current) => ({ ...current, [currency]: { loading: true } }));
      fetchExchangeRate(currency, controller.signal)
        .then((quote) => setQuotes((current) => ({ ...current, [currency]: quote })))
        .catch((error) => {
          if (!controller.signal.aborted)
            setQuotes((current) => ({
              ...current,
              [currency]: { error: error.message },
            }));
        });
    }
    return () => controller.abort();
  }, [key, retry]);
  return { quotes, retryRates: () => setRetry((value) => value + 1) };
}
