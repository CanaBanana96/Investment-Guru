import { useEffect, useMemo, useState } from 'react';
import { samplePortfolio } from '../data/samplePortfolio';

const refreshMs = 60000;

export function useLiveSamplePortfolio() {
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const stockTickers = useMemo(
    () => samplePortfolio.filter(holding => holding.type === 'Stock').map(holding => holding.symbol),
    []
  );

  useEffect(() => {
    let isMounted = true;

    async function loadQuotes() {
      if (stockTickers.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/stocks?tickers=${encodeURIComponent(stockTickers.join(','))}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Unable to load live sample portfolio prices.');

        const nextQuotes = data.reduce((acc, quote) => {
          if (!quote.error && quote.price != null) {
            acc[quote.ticker] = quote;
          }
          return acc;
        }, {});

        if (isMounted) {
          setQuotes(nextQuotes);
          setLastUpdated(new Date());
          setError('');
        }
      } catch (quoteError) {
        if (isMounted) setError(quoteError.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    setLoading(true);
    loadQuotes();
    const intervalId = window.setInterval(loadQuotes, refreshMs);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [stockTickers]);

  const portfolio = useMemo(
    () =>
      samplePortfolio.map((holding) => {
        if (holding.type !== 'Stock') return holding;

        const quote = quotes[holding.symbol];
        const currentPrice = quote?.price ?? holding.fallbackPrice ?? getFallbackPrice(holding);
        const shares = Number(holding.shares) || 0;

        return {
          ...holding,
          currentPrice,
          liveChange: quote?.change,
          livePercentChange: quote?.percent_change,
          isLive: Boolean(quote),
          value: Math.round(shares * currentPrice),
        };
      }),
    [quotes]
  );

  return {
    portfolio,
    quotes,
    loading,
    error,
    lastUpdated,
  };
}

function getFallbackPrice(holding) {
  const shares = Number(holding.shares);
  const value = Number(holding.value);
  return shares > 0 && value > 0 ? value / shares : 0;
}
