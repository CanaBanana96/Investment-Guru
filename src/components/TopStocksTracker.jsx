import { useEffect, useMemo, useState } from 'react';
import { topStocks } from '../data/topStocks';

const initialVisibleCount = 3;
const stockNames = {
  AAPL: 'Apple',
  MSFT: 'Microsoft',
  GOOGL: 'Alphabet',
  AMZN: 'Amazon',
  TSLA: 'Tesla',
  NVDA: 'NVIDIA',
  META: 'Meta',
  NFLX: 'Netflix',
  BABA: 'Alibaba',
  ORCL: 'Oracle',
  CRM: 'Salesforce',
  AMD: 'Advanced Micro Devices',
  INTC: 'Intel',
  UBER: 'Uber',
  SPOT: 'Spotify',
  PYPL: 'PayPal',
  SQ: 'Block',
  SHOP: 'Shopify',
  ZOOM: 'Zoom',
  DOCU: 'DocuSign',
  COIN: 'Coinbase',
  PLTR: 'Palantir',
  SNOW: 'Snowflake',
  DDOG: 'Datadog',
  NET: 'Cloudflare',
  CRWD: 'CrowdStrike',
  ZS: 'Zscaler',
  OKTA: 'Okta',
  MDB: 'MongoDB',
  TWLO: 'Twilio',
  RUM: 'Rumble',
  PINS: 'Pinterest',
  FVRR: 'Fiverr',
  UPST: 'Upstart',
  SOFI: 'SoFi',
  AFRM: 'Affirm',
  LCID: 'Lucid',
  RIVN: 'Rivian',
  NIO: 'NIO',
  XPEV: 'XPeng',
  LI: 'Li Auto',
};

export default function TopStocksTracker() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('percent_change');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchValue, setSearchValue] = useState('');
  const [selectedTicker, setSelectedTicker] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadTopStocks() {
      try {
        const tickersParam = topStocks.join(',');
        const response = await fetch(`/api/stocks?tickers=${encodeURIComponent(tickersParam)}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Unable to load stock quotes.');

        if (isMounted) {
          setQuotes(data.filter(quote => !quote.error && quote.percent_change != null));
          setError('');
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    setLoading(true);
    loadTopStocks();

    // Refresh every 60 seconds for top stocks (less frequent than individual stocks)
    const intervalId = setInterval(loadTopStocks, 60000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const sortedQuotes = useMemo(
    () =>
      [...quotes].sort((a, b) => {
        const aVal = sortBy === 'percent_change' ? a.percent_change : a.price;
        const bVal = sortBy === 'percent_change' ? b.percent_change : b.price;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      }),
    [quotes, sortBy, sortOrder]
  );

  const displayedQuotes = useMemo(() => {
    const filteredQuotes = selectedTicker
      ? sortedQuotes.filter(quote => quote.ticker === selectedTicker)
      : sortedQuotes;

    return isExpanded || selectedTicker ? filteredQuotes : filteredQuotes.slice(0, initialVisibleCount);
  }, [isExpanded, selectedTicker, sortedQuotes]);

  const searchHint = useMemo(() => {
    const normalizedValue = normalizeSearch(searchValue);
    if (!normalizedValue || selectedTicker) return '';

    const match = findAvailableTicker(normalizedValue);
    return match ? `Press Enter for ${match}` : 'No available match';
  }, [searchValue, selectedTicker]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleSearchChange = (event) => {
    const value = event.target.value.toUpperCase();
    setSearchValue(value);
    setSelectedTicker(topStocks.includes(value) ? value : '');
    setIsExpanded(false);
  };

  const applySearch = () => {
    const match = findAvailableTicker(searchValue);
    setSelectedTicker(match);
    setSearchValue(match);
    setIsExpanded(false);
  };

  const clearSearch = () => {
    setSearchValue('');
    setSelectedTicker('');
    setIsExpanded(false);
  };

  return (
    <div className="rounded-lg border border-teal-900/10 bg-white p-5 shadow-sm shadow-teal-950/5">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Market watch</p>
          <h2 className="mt-1 text-lg font-semibold">Top stocks</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:w-[520px]">
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="stockSearch">
              Search available stocks
            </label>
            <div className="mt-1 flex rounded-md border border-teal-900/20 bg-white focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-amber-200">
              <input
                id="stockSearch"
                list="stockOptions"
                value={searchValue}
                onBlur={applySearch}
                onChange={handleSearchChange}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applySearch();
                  }
                }}
                placeholder="AAPL, Apple, NVDA..."
                className="min-w-0 flex-1 rounded-md px-3 py-2 text-sm outline-none"
              />
              {searchValue && (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={clearSearch}
                  className="px-3 text-sm font-semibold text-teal-700 transition hover:text-teal-900"
                >
                  Clear
                </button>
              )}
            </div>
            <datalist id="stockOptions">
              {topStocks.map((ticker) => (
                <option key={ticker} value={ticker}>
                  {stockNames[ticker] || ticker}
                </option>
              ))}
            </datalist>
            {searchHint && <p className="mt-1 text-xs text-amber-700">{searchHint}</p>}
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => handleSort('percent_change')}
              className={`h-10 rounded-md px-3 text-sm font-semibold transition ${
                sortBy === 'percent_change'
                  ? 'bg-teal-900 text-white'
                  : 'bg-[#f6f3ec] text-slate-700 hover:bg-amber-50'
              }`}
            >
              Change {sortBy === 'percent_change' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              type="button"
              onClick={() => handleSort('price')}
              className={`h-10 rounded-md px-3 text-sm font-semibold transition ${
                sortBy === 'price'
                  ? 'bg-teal-900 text-white'
                  : 'bg-[#f6f3ec] text-slate-700 hover:bg-amber-50'
              }`}
            >
              Price {sortBy === 'price' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
          </div>
        </div>
      </div>

      {loading && <p className="mb-4 text-sm text-slate-500">Loading top stocks...</p>}
      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

      <div className="grid gap-3 md:grid-cols-3">
        {displayedQuotes.map((quote) => {
          const change = quote.percent_change ?? 0;
          const isPositive = change >= 0;

          return (
            <div key={quote.ticker} className="rounded-lg border border-teal-900/10 bg-[#fbfaf7] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-semibold text-slate-900">{quote.ticker}</h4>
                  <p className="truncate text-xs text-slate-500">{stockNames[quote.ticker] || 'Live quote'}</p>
                </div>
              </div>

              <div className="mt-2">
                <p className="text-lg font-semibold text-slate-900">
                  {quote.price == null ? '--' : formatPrice(quote.price)}
                </p>
                <p className={`mt-1 text-sm font-semibold ${isPositive ? 'text-teal-700' : 'text-red-700'}`}>
                  {quote.percent_change == null ? '--' : `${isPositive ? '+' : ''}${quote.percent_change.toFixed(2)}%`}
                </p>
                {quote.change != null && (
                  <p className="mt-1 text-xs text-slate-500">
                    {formatPrice(quote.change)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!selectedTicker && sortedQuotes.length > initialVisibleCount && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setIsExpanded(current => !current)}
            className="inline-flex h-10 items-center justify-center rounded-md border border-teal-900/20 bg-white px-4 text-sm font-semibold text-teal-800 transition hover:bg-amber-50"
          >
            {isExpanded ? 'Show 3 stocks' : `Show all ${sortedQuotes.length} stocks`}
          </button>
        </div>
      )}

      {displayedQuotes.length === 0 && !loading && (
        <p className="py-8 text-center text-sm text-slate-500">No stock data available</p>
      )}
    </div>
  );
}

function normalizeSearch(value) {
  return value.trim().toUpperCase();
}

function findAvailableTicker(value) {
  const normalizedValue = normalizeSearch(value);
  if (!normalizedValue) return '';

  const exactTicker = topStocks.find(ticker => ticker === normalizedValue);
  if (exactTicker) return exactTicker;

  const nameMatch = topStocks.find((ticker) => {
    const stockName = stockNames[ticker]?.toUpperCase() || '';
    return stockName === normalizedValue || stockName.startsWith(normalizedValue);
  });
  if (nameMatch) return nameMatch;

  return (
    topStocks.find(ticker => ticker.startsWith(normalizedValue)) ||
    topStocks.find(ticker => ticker.includes(normalizedValue)) ||
    topStocks.find((ticker) => (stockNames[ticker]?.toUpperCase() || '').includes(normalizedValue)) ||
    ''
  );
}

function formatPrice(value) {
  if (value == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}
