export default function LivePortfolioTracker({ portfolio }) {
  const stockHoldings = portfolio
    .filter(holding => holding.type === 'Stock')
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  const hasLiveQuotes = stockHoldings.some(holding => holding.isLive);

  if (stockHoldings.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Live Stock Updates</h3>
          <p className="mt-1 text-sm text-slate-600">All stock holdings from this portfolio.</p>
        </div>
        <span className="text-xs font-semibold text-teal-700">
          {hasLiveQuotes ? 'Live API feed' : 'Fallback prices'}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {stockHoldings.map((holding) => {
          const change = holding.livePercentChange ?? 0;
          const isPositive = change >= 0;

          return (
            <div key={holding.symbol} className="rounded-lg border border-teal-900/10 bg-[#fbfaf7] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{holding.symbol}</h4>
                  <p className="mt-1 text-xs text-slate-500">{holding.name}</p>
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {holding.isLive ? 'Live' : 'Fallback'}
                </span>
              </div>

              <div className="mt-3">
                <p className="text-lg font-semibold text-slate-900">
                  {formatPrice(holding.currentPrice)}
                </p>
                <p className={`mt-1 text-sm font-semibold ${isPositive ? 'text-teal-700' : 'text-red-700'}`}>
                  {holding.isLive ? `${isPositive ? '+' : ''}${change.toFixed(2)}%` : 'Demo fallback'}
                </p>
                {holding.liveChange != null && (
                  <p className="mt-1 text-xs text-slate-500">
                    Change: {formatPrice(holding.liveChange)}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  Holding value: {formatPrice(holding.value)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
