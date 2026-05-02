import { useEffect, useState } from 'react';

const fallbackMarketData = {
  vix: 18.5,
  marketTrend: 'neutral',
  sp500: '+0.8%',
  news: ['Fed signals rate cuts', 'Inflation cooling'],
  fearLevel: 'calm',
  lastUpdated: null,
  source: 'fallback',
};

export function useMarketData() {
  const [marketData, setMarketData] = useState(fallbackMarketData);

  useEffect(() => {
    let isMounted = true;

    async function fetchMarketData() {
      try {
        const [vixResponse, spyResponse] = await Promise.all([
          fetch('/api/stock/%5EVIX'),
          fetch('/api/stock/SPY'),
        ]);
        const [vixData, spyData] = await Promise.all([
          vixResponse.json(),
          spyResponse.json(),
        ]);

        if (!vixResponse.ok || !spyResponse.ok) {
          throw new Error('Market data unavailable.');
        }

        const vix = Number(vixData.price) || fallbackMarketData.vix;
        const spyChange = Number(spyData.percent_change);

        if (isMounted) {
          setMarketData({
            vix,
            marketTrend: getMarketTrend(vix, spyChange),
            sp500: Number.isFinite(spyChange) ? `${spyChange >= 0 ? '+' : ''}${spyChange.toFixed(2)}%` : fallbackMarketData.sp500,
            news: buildMarketNotes(vix, spyChange),
            fearLevel: getFearLevel(vix),
            lastUpdated: new Date(),
            source: 'live',
          });
        }
      } catch {
        if (isMounted) {
          setMarketData({
            ...fallbackMarketData,
            lastUpdated: new Date(),
          });
        }
      }
    }

    fetchMarketData();
    const intervalId = window.setInterval(fetchMarketData, 3600000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return marketData;
}

function getMarketTrend(vix, spyChange) {
  if (vix >= 30 || spyChange < -1.5) return 'bearish';
  if (vix < 20 && spyChange > 0) return 'bullish';
  return 'neutral';
}

function getFearLevel(vix) {
  if (vix < 20) return 'calm';
  if (vix < 30) return 'nervous';
  return 'fearful';
}

function buildMarketNotes(vix, spyChange) {
  const notes = [];

  if (vix < 20) notes.push('Market volatility is calm');
  else if (vix < 30) notes.push('Investors are getting more nervous');
  else notes.push('Market fear is elevated');

  if (Number.isFinite(spyChange)) {
    notes.push(`S&P 500 proxy SPY is ${spyChange >= 0 ? 'up' : 'down'} ${Math.abs(spyChange).toFixed(2)}% today`);
  }

  return notes;
}
