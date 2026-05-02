import { useMemo, useState } from 'react';
import { summarizePortfolio } from '../solvers/rebalanceSolver';

const riskStyles = {
  Safe: 'border-teal-200 bg-teal-50 text-teal-800',
  Balanced: 'border-amber-200 bg-amber-50 text-amber-800',
  Risky: 'border-rose-200 bg-rose-50 text-rose-800',
};

const mockPortfolio = [
  {
    symbol: 'AAPL',
    name: 'Apple',
    type: 'Stock',
    bucket: 'Single stocks',
    value: 11250,
    risk: 5,
  },
  {
    symbol: 'TSLA',
    name: 'Tesla',
    type: 'Stock',
    bucket: 'Single stocks',
    value: 8200,
    risk: 5,
  },
  {
    symbol: 'VTI',
    name: 'Total US Stock Market ETF',
    type: 'Fund',
    bucket: 'Broad stocks',
    value: 21000,
    risk: 4,
  },
  {
    symbol: 'BND',
    name: 'Total Bond Market ETF',
    type: 'Fund',
    bucket: 'Bonds',
    value: 12400,
    risk: 2,
  },
  {
    symbol: 'VMFXX',
    name: 'Money Market Fund',
    type: 'Fund',
    bucket: 'Cash',
    value: 5200,
    risk: 1,
  },
];

export function calculateRisk(portfolio) {
  const holdings = Array.isArray(portfolio) ? portfolio : [];
  const total = holdings.reduce((sum, asset) => sum + getHoldingValue(asset), 0);
  const bucketSums = holdings.reduce(
    (acc, asset) => {
      const classification = classifyAssetRisk(asset);
      acc[classification] += getHoldingValue(asset);
      return acc;
    },
    { High: 0, Medium: 0, Low: 0 }
  );

  if (total <= 0) {
    return {
      riskLevel: 'Balanced',
      distribution: { highPct: 0, mediumPct: 0, lowPct: 0 },
      totals: bucketSums,
      total: 0,
    };
  }

  const highPct = Math.round((bucketSums.High / total) * 100);
  const mediumPct = Math.round((bucketSums.Medium / total) * 100);
  const lowPct = Math.round((bucketSums.Low / total) * 100);

  let riskLevel = 'Balanced';
  if (lowPct >= 50) riskLevel = 'Safe';
  else if (highPct >= 45) riskLevel = 'Risky';

  return {
    riskLevel,
    distribution: { highPct, mediumPct, lowPct },
    totals: bucketSums,
    total,
  };
}

export function generateRebalancePlan(portfolio) {
  const analysis = calculateRisk(portfolio);
  const holdings = Array.isArray(portfolio) ? portfolio : [];
  const lowRiskAsset = holdings.find((asset) => classifyAssetRisk(asset) === 'Low');
  const targetBuyName = lowRiskAsset ? lowRiskAsset.name : 'Bond ETF';
  const targetBuySymbol = lowRiskAsset ? lowRiskAsset.symbol : 'BOND';

  const highRiskAssets = holdings
    .filter((asset) => classifyAssetRisk(asset) === 'High')
    .map((asset) => ({
      ...asset,
      percent: analysis.total > 0 ? Math.round((getHoldingValue(asset) / analysis.total) * 100) : 0,
    }))
    .sort((a, b) => b.percent - a.percent);

  if (analysis.total <= 0) {
    return {
      riskLevel: 'Balanced',
      actions: [],
      summary: 'Add holdings to your portfolio to generate a safety plan.',
      explanation:
        'We need at least one holding with a positive value before we can compare risk or recommend trades.',
      feeEstimate: '$0',
      taxNote: 'No trades are recommended until portfolio values are available.',
      tradeoff: 'Add current holdings first, then review risk.',
    };
  }

  if (analysis.riskLevel === 'Safe') {
    return {
      riskLevel: 'Safe',
      actions: [],
      summary: 'Your portfolio is already well balanced and has a healthy mix of low-risk holdings.',
      explanation:
        'We keep your current mix because it already has more stable assets. This helps protect your portfolio without changing the long-term plan.',
      feeEstimate: '$5–$15',
      taxNote: 'Selling some investments may trigger short-term taxes.',
      tradeoff: 'Lower risk, but slightly lower potential returns.',
    };
  }

  const sellPct = analysis.riskLevel === 'Risky' ? 8 : 5;
  const sellAssets = highRiskAssets.slice(0, 2);
  const totalSellPct = sellAssets.reduce((sum, asset) => sum + sellPct, 0);

  if (sellAssets.length === 0) {
    return {
      riskLevel: analysis.riskLevel,
      actions: [],
      summary: 'Your portfolio does not have an obvious high-risk holding to trim.',
      explanation:
        'We avoid creating a trade when there is no concentrated stock position to reduce. Review your target allocation before making manual changes.',
      feeEstimate: '$0',
      taxNote: 'No sales are recommended by this starter plan.',
      tradeoff: 'Lower disruption, but no immediate change to your allocation.',
    };
  }

  const actions = [];
  sellAssets.forEach((asset) => {
    actions.push({
      type: 'Sell',
      symbol: asset.symbol,
      name: asset.name,
      amount: `${sellPct}%`,
      detail: `Reduce exposure from ${asset.symbol} so your portfolio becomes more stable.`,
    });
  });

  actions.push({
    type: 'Buy',
    symbol: targetBuySymbol,
    name: targetBuyName,
    amount: `${totalSellPct}%`,
    detail: `Reallocate the proceeds into a lower-risk fund to soften swings and improve stability.`,
  });

  const explanation =
    analysis.riskLevel === 'Risky'
      ? 'We reduced your exposure to high-risk stocks to protect your portfolio from large drops when markets fall. This keeps the plan more stable while still leaving room for growth.'
      : 'We made a small adjustment by moving some risk from the highest-risk holdings into more stable funds. That keeps your portfolio balanced without dramatic changes.';

  return {
    riskLevel: analysis.riskLevel,
    actions,
    summary:
      analysis.riskLevel === 'Risky'
        ? 'Your portfolio has a strong stock tilt and can benefit from a safer mix.'
        : 'Your portfolio is mostly balanced, but a small shift would improve long-term comfort.',
    explanation,
    feeEstimate: '$5–$15',
    taxNote: 'Selling some investments may trigger short-term taxes.',
    tradeoff: 'Lower risk, but slightly lower potential returns.',
  };
}

function classifyAssetRisk(asset) {
  const name = String(asset.name || '').toLowerCase();
  const bucket = String(asset.bucket || '').toLowerCase();
  const type = String(asset.type || '').toLowerCase();

  if (type === 'stock' || bucket.includes('single')) return 'High';
  if (bucket.includes('bond') || bucket === 'bonds' || bucket === 'cash') return 'Low';
  if (name.includes('bond') || name.includes('money market') || name.includes('cash')) return 'Low';
  return 'Medium';
}

function getHoldingValue(holding) {
  const value = Number(holding?.value);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

// Simulate rebalanced portfolio
export function simulateRebalancedPortfolio(portfolio) {
  const plan = generateRebalancePlan(portfolio);
  if (plan.riskLevel === 'Safe') return portfolio; // No changes

  const holdings = Array.isArray(portfolio) ? portfolio : [];
  const newPortfolio = holdings.map((asset) => ({ ...asset })); // Deep copy

  let totalSold = 0;

  // Apply sells
  plan.actions.filter((action) => action.type === 'Sell').forEach((action) => {
    const pct = parseInt(action.amount) / 100;
    const asset = newPortfolio.find((a) => a.symbol === action.symbol);
    if (asset) {
      const soldAmount = getHoldingValue(asset) * pct;
      totalSold += soldAmount;
      asset.value = getHoldingValue(asset) - soldAmount;
    }
  });

  // Apply buys
  const buyAction = plan.actions.find((action) => action.type === 'Buy');
  if (buyAction) {
    const asset = newPortfolio.find((a) => a.symbol === buyAction.symbol);
    const amount = totalSold * 0.98; // Simulate 2% fee
    if (asset) {
      asset.value = getHoldingValue(asset) + amount;
    } else if (amount > 0) {
      newPortfolio.push({
        symbol: buyAction.symbol,
        name: buyAction.name,
        type: 'Fund',
        bucket: 'Bonds',
        value: amount,
        risk: 2,
      });
    }
  }

  return newPortfolio;
}

// Generate action list
export function generateActionList(portfolio) {
  const plan = generateRebalancePlan(portfolio);
  return plan.actions;
}

function BeforeAfterModal({ isOpen, onClose, beforePortfolio, afterPortfolio, selectedGoal, selectedRisk }) {
  if (!isOpen) return null;

  const beforeSummary = summarizePortfolio(beforePortfolio);
  const afterSummary = summarizePortfolio(afterPortfolio);
  const beforeRisk = calculateRisk(beforePortfolio);
  const afterRisk = calculateRisk(afterPortfolio);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300">
      <div className="mx-4 max-w-4xl rounded-3xl bg-white p-6 shadow-2xl transition-transform duration-300">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Portfolio Transformation</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-teal-900/10 bg-[#fbfaf7] p-5">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Before</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-500">Portfolio Value</p>
                <p className="text-xl font-semibold text-slate-900">${beforeSummary.total.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Risk Level</p>
                <span className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold ${riskStyles[beforeRisk.riskLevel]}`}>
                  {beforeRisk.riskLevel}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Health Score</p>
                <p className="text-xl font-semibold text-slate-900">{beforeSummary.healthScore}/100</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl">→</div>
              <p className="mt-2 text-sm font-medium text-slate-600">Safer, less volatile</p>
            </div>
          </div>

          <div className="rounded-3xl border border-teal-900/10 bg-[#fbfaf7] p-5">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">After</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-500">Portfolio Value</p>
                <p className="text-xl font-semibold text-slate-900">${afterSummary.total.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Risk Level</p>
                <span className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold ${riskStyles[afterRisk.riskLevel]}`}>
                  {afterRisk.riskLevel}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Health Score</p>
                <p className="text-xl font-semibold text-slate-900">{afterSummary.healthScore}/100</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Goal outcome</p>
                <p className="text-sm font-semibold text-teal-700">{getAfterOutcome(selectedGoal, selectedRisk)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Recommended Changes</h3>
          <div className="space-y-3">
            {generateActionList(beforePortfolio).map((action, index) => (
              <div
                key={index}
                className="rounded-2xl border border-teal-900/10 bg-white p-4 shadow-sm transition hover:border-teal-700/30"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {action.type}: {action.name} ({action.symbol}) → {action.amount}
                </p>
                <p className="mt-1 text-sm text-slate-600">{action.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-teal-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function FixPortfolio({ portfolio = mockPortfolio, updatePortfolio, selectedGoal = 'grow-wealth', selectedRisk = 'medium' }) {
  const [analysis, setAnalysis] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [beforePortfolio, setBeforePortfolio] = useState(null);
  const [afterPortfolio, setAfterPortfolio] = useState(null);

  const currentRisk = useMemo(() => calculateRisk(portfolio), [portfolio]);

  const handleRunAnalysis = () => {
    setIsProcessing(true);
    setAnalysis(null);
    window.setTimeout(() => {
      const plan = generateRebalancePlan(portfolio);
      const simulatedPortfolio = simulateRebalancedPortfolio(portfolio);
      setAnalysis(plan);
      setBeforePortfolio(portfolio);
      setAfterPortfolio(simulatedPortfolio);
      setIsProcessing(false);
      if (updatePortfolio) updatePortfolio(simulatedPortfolio);
      setIsModalOpen(true);
    }, 1200);
  };

  return (
    <div className="rounded-3xl border border-teal-900/10 bg-white p-6 shadow-sm shadow-teal-950/5 transition duration-300 hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Safety check</p>
            <div className="group relative">
              <button
                type="button"
                aria-describedby="safety-check-tooltip"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-teal-900/20 bg-white text-xs font-semibold text-teal-800 focus:outline-none focus:ring-2 focus:ring-amber-200"
              >
                ?
              </button>
              <div
                id="safety-check-tooltip"
                role="tooltip"
                className="pointer-events-none absolute left-0 top-7 z-20 hidden w-72 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs leading-5 text-slate-600 shadow-xl shadow-slate-950/10 group-hover:block group-focus-within:block"
              >
                This checks whether too much money sits in higher-risk holdings, then suggests a simpler mix that may reduce big portfolio swings.
              </div>
            </div>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Make My Portfolio Safer</h2>
          <p className="mt-2 max-w-xl text-sm text-slate-600">
            One click to see what is making the portfolio jumpy and what small changes could calm it down.
          </p>
        </div>
        <button
          id="make-portfolio-safer-button"
          type="button"
          onClick={handleRunAnalysis}
          disabled={isProcessing}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-teal-900 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isProcessing ? 'Analyzing...' : 'Make My Portfolio Safer'}
        </button>
      </div>

      <div className="mt-6 rounded-3xl border border-teal-900/10 bg-[#fbfaf7] p-4 text-sm text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-teal-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
            Current risk
          </span>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskStyles[currentRisk.riskLevel]}`}>
            {currentRisk.riskLevel}
          </span>
          <span>High: {currentRisk.distribution.highPct}%</span>
          <span>Low: {currentRisk.distribution.lowPct}%</span>
        </div>
        <p className="mt-3 text-sm font-semibold text-teal-800">
          After: {getAfterOutcome(selectedGoal, selectedRisk)}
        </p>
      </div>

      {analysis && (
        <div className="mt-6 space-y-5 transition duration-500">
          <div className="rounded-3xl border border-teal-900/10 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Recommended Changes</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{analysis.summary}</h3>
              </div>
              <span className={`rounded-full border px-3 py-2 text-sm font-semibold ${riskStyles[analysis.riskLevel]}`}>
                {analysis.riskLevel}
              </span>
            </div>

            {analysis.actions.length > 0 ? (
              <div className="mt-5 space-y-3">
                {analysis.actions.map((action) => (
                  <div
                    key={`${action.type}-${action.symbol}`}
                    className="rounded-2xl border border-teal-900/10 bg-[#fbfaf7] p-4 transition hover:border-teal-700/30"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {action.type}: {action.name} ({action.symbol}) → {action.amount}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{action.detail}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800">
                <p className="font-semibold">Your portfolio is already well balanced.</p>
                <p className="mt-2">No changes are needed today, and your current mix is already stable.</p>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-teal-900/10 bg-[#fbfaf7] p-5">
            <p className="text-sm font-semibold text-slate-900">Why we recommend this</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">{analysis.explanation}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-teal-900/10 bg-white p-4 text-sm">
              <p className="font-semibold text-slate-900">Estimated fees</p>
              <p className="mt-2 text-slate-600">{analysis.feeEstimate}</p>
            </div>
            <div className="rounded-3xl border border-teal-900/10 bg-white p-4 text-sm">
              <p className="font-semibold text-slate-900">Tax note</p>
              <p className="mt-2 text-slate-600">{analysis.taxNote}</p>
            </div>
            <div className="rounded-3xl border border-teal-900/10 bg-white p-4 text-sm">
              <p className="font-semibold text-slate-900">Tradeoff</p>
              <p className="mt-2 text-slate-600">{analysis.tradeoff}</p>
            </div>
          </div>
        </div>
      )}

      <BeforeAfterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        beforePortfolio={beforePortfolio}
        afterPortfolio={afterPortfolio}
        selectedGoal={selectedGoal}
        selectedRisk={selectedRisk}
      />
    </div>
  );
}

function getAfterOutcome(goal, risk) {
  if (goal === 'buy-home') return '50% cash, crash loss: -$5,000';
  if (goal === 'retire-early') return '75% stocks, long-term return: +8-10% expected';
  if (goal === 'protect-savings') return '80% bonds, volatility reduced by 60%';
  if (risk === 'low') return 'Conservative allocation with more bonds and cash';
  if (risk === 'high') return 'Aggressive allocation with higher stock exposure';
  return 'Balanced allocation with growth and a safety net';
}

export default FixPortfolio;
