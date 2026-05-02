import { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../solvers/rebalanceSolver';

const ranges = [
  { id: '1m', label: '1M' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
];

export default function StockInspector({ portfolio }) {
  const stocks = useMemo(() => portfolio.filter(holding => holding.type === 'Stock'), [portfolio]);
  const [ticker, setTicker] = useState(stocks[0]?.symbol || '');
  const [range, setRange] = useState('1m');
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!stocks.some(stock => stock.symbol === ticker)) {
      setTicker(stocks[0]?.symbol || '');
    }
  }, [stocks, ticker]);

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      if (!ticker) return;
      setLoading(true);
      try {
        const response = await fetch(`/api/stock/${encodeURIComponent(ticker)}/history?range=${range}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Unable to load ${ticker} history.`);

        if (isMounted) {
          setHistory(data);
          setError('');
        }
      } catch (historyError) {
        if (isMounted) setError(historyError.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [ticker, range]);

  const selectedStock = stocks.find(stock => stock.symbol === ticker);
  const chartPoints = history?.points || [];
  const change = history?.percent_change ?? selectedStock?.livePercentChange ?? 0;
  const isPositive = change >= 0;

  return (
    <section className="rounded-lg border border-teal-900/10 bg-white p-5 shadow-sm shadow-teal-950/5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Stock inspection</p>
          <h2 className="mt-1 text-lg font-semibold">Inspect one holding</h2>
          <p className="mt-1 text-sm text-slate-600">
            Review one live guest stock and see how its price has moved over time.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[180px_auto]">
          <label className="text-sm font-medium text-slate-700">
            Stock
            <select
              value={ticker}
              onChange={(event) => setTicker(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-teal-900/20 bg-white px-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-amber-200"
            >
              {stocks.map(stock => (
                <option key={stock.symbol} value={stock.symbol}>
                  {stock.symbol}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            {ranges.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRange(item.id)}
                className={`h-10 rounded-md px-3 text-sm font-semibold transition ${
                  range === item.id
                    ? 'bg-teal-900 text-white'
                    : 'bg-[#f6f3ec] text-slate-700 hover:bg-amber-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-lg border border-teal-900/10 bg-[#fbfaf7] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{selectedStock?.symbol} price history</p>
              <p className="text-xs text-slate-500">{selectedStock?.name}</p>
            </div>
            {loading && <span className="text-xs font-semibold text-slate-500">Loading</span>}
          </div>
          {error ? (
            <p className="mt-6 text-sm text-red-700">{error}</p>
          ) : (
            <PriceChart points={chartPoints} isPositive={isPositive} />
          )}
        </div>

        <div className="rounded-lg border border-teal-900/10 bg-white p-4">
          <p className="text-sm font-medium text-slate-500">Latest price</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {formatCurrency(history?.price ?? selectedStock?.currentPrice ?? 0)}
          </p>
          <p className={`mt-2 text-sm font-semibold ${isPositive ? 'text-teal-700' : 'text-red-700'}`}>
            {formatPercent(change)} over {range.toUpperCase()}
          </p>
          <p className="mt-4 text-sm text-slate-600">
            Your guest demo holds {selectedStock?.shares || 0} shares, worth {formatCurrency(selectedStock?.value || 0)}.
          </p>
        </div>
      </div>
    </section>
  );
}

function PriceChart({ points }) {
  const width = 640;
  const height = 260;
  const padding = { top: 22, right: 18, bottom: 44, left: 58 };
  const chartPoints = points
    .filter(point => Number.isFinite(point.close))
    .map(point => ({ ...point, date: new Date(point.date) }));
  const closes = chartPoints.map(point => point.close);

  if (closes.length < 2) {
    return <div className="mt-4 flex h-[220px] items-center justify-center text-sm text-slate-500">Not enough chart data yet.</div>;
  }

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const spread = max - min || 1;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const step = plotWidth / (closes.length - 1);
  const coords = chartPoints.map((point, index) => ({
    ...point,
    x: padding.left + index * step,
    y: padding.top + plotHeight - ((point.close - min) / spread) * plotHeight,
  }));
  const yTicks = [max, min + spread / 2, min];
  const xTickIndexes = [0, Math.floor((coords.length - 1) / 2), coords.length - 1];

  return (
    <svg className="mt-4 h-[260px] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Stock price chart">
      {yTicks.map((tick) => {
        const y = padding.top + plotHeight - ((tick - min) / spread) * plotHeight;
        return (
          <g key={tick}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e7e5df" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
              ${tick.toFixed(0)}
            </text>
          </g>
        );
      })}
      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#cbd5e1" />
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#cbd5e1" />
      {coords.slice(1).map((point, index) => {
        const previous = coords[index];
        const positive = point.close >= previous.close;
        return (
          <line
            key={`${point.date.toISOString()}-${index}`}
            x1={previous.x}
            y1={previous.y}
            x2={point.x}
            y2={point.y}
            stroke={positive ? '#2563eb' : '#dc2626'}
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}
      {coords.map((point, index) => (
        <circle
          key={point.date.toISOString()}
          cx={point.x}
          cy={point.y}
          r={index === 0 || index === coords.length - 1 ? 3 : 2}
          fill="#ffffff"
          stroke={index > 0 && point.close < coords[index - 1].close ? '#dc2626' : '#2563eb'}
          strokeWidth="2"
        />
      ))}
      {xTickIndexes.map(index => {
        const point = coords[index];
        return (
          <g key={index}>
            <line x1={point.x} y1={height - padding.bottom} x2={point.x} y2={height - padding.bottom + 5} stroke="#cbd5e1" />
            <text x={point.x} y={height - 20} textAnchor="middle" className="fill-slate-500 text-[11px]">
              {formatChartDate(point.date)}
            </text>
          </g>
        );
      })}
      <text x={18} y={height / 2} textAnchor="middle" transform={`rotate(-90 18 ${height / 2})`} className="fill-slate-500 text-[11px]">
        Price
      </text>
      <text x={width / 2} y={height - 4} textAnchor="middle" className="fill-slate-500 text-[11px]">
        Date
      </text>
    </svg>
  );
}

function formatChartDate(date) {
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatPercent(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${safeValue >= 0 ? '+' : ''}${safeValue.toFixed(2)}%`;
}
