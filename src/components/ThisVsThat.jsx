import { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../solvers/rebalanceSolver';

const fallbackPortfolioValue = 86350;

const goalProfiles = {
  'buy-home': { label: 'Buy a home', tilt: -0.4 },
  education: { label: "Child's education", tilt: 0.3 },
  'retire-early': { label: 'Retire early', tilt: 1.3 },
  'grow-wealth': { label: 'Grow wealth', tilt: 1 },
  'protect-savings': { label: 'Protect savings', tilt: -0.9 },
  'regular-income': { label: 'Regular income', tilt: -0.1 },
  growth: { label: 'Grow wealth', tilt: 1 },
  income: { label: 'Regular income', tilt: -0.1 },
  safety: { label: 'Protect savings', tilt: -0.9 },
};

const riskAdjustments = {
  low: -0.6,
  medium: 0,
  high: 0.8,
};

const bucketReturnAssumptions = {
  'Single stocks': 7.5,
  'Broad stocks': 7,
  'International stocks': 6.3,
  Bonds: 3.7,
  Cash: 2,
};

export default function ThisVsThat({ selectedGoal = 'growth', selectedRisk = 'medium', currentPortfolioValue, portfolio = [], targetAllocation = {} }) {
  const projection = useMemo(
    () => buildProjection({ selectedGoal, selectedRisk, currentPortfolioValue, portfolio, targetAllocation }),
    [selectedGoal, selectedRisk, currentPortfolioValue, portfolio, targetAllocation]
  );
  const currentFinal = projection.currentPath.at(-1);
  const recommendedFinal = projection.recommendedPath.at(-1);
  const difference = recommendedFinal - currentFinal;
  const bigGap = difference > 10000;
  const hugeGap = difference > 50000;

  return (
    <section className="rounded-lg border border-teal-900/10 bg-white p-5 shadow-sm shadow-teal-950/5">
      <div className="flex flex-col gap-2 border-b border-teal-900/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">This vs That</p>
          <h2 className="mt-1 text-lg font-semibold">📊 This vs That — 5 Year Projection</h2>
        </div>
        <div className="group relative inline-flex items-center gap-2 self-start text-xs font-semibold text-slate-500">
          <span>{projection.goalLabel} live allocation model</span>
          <button type="button" className="flex h-5 w-5 items-center justify-center rounded-full border border-teal-900/20 bg-white text-teal-800 focus:outline-none focus:ring-2 focus:ring-amber-200">
            i
          </button>
          <span className="pointer-events-none absolute right-0 top-7 z-20 hidden w-64 rounded-lg border border-slate-200 bg-white p-3 text-xs font-medium leading-5 text-slate-600 shadow-xl group-hover:block group-focus-within:block">
            Current path uses your live allocation. Recommended path uses the target allocation for your selected risk, then adjusts for the goal.
          </span>
        </div>
      </div>

      <div className="mt-5 grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)]">
        <ProjectionPath
          title="Current Path"
          subtitle="Your Portfolio"
          path={projection.currentPath}
          rate={projection.currentRate}
          color="blue"
          progress={60}
        />

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white shadow-sm">
          VS
        </div>

        <ProjectionPath
          title="Recommended Path"
          subtitle="Guru-Ji Target"
          path={projection.recommendedPath}
          rate={projection.recommendedRate}
          color="green"
          progress={100}
        />
      </div>

      <div className="mt-5 rounded-lg border border-teal-900/10 bg-[#fbfaf7] p-4 text-center">
        {bigGap ? (
          <p className="text-base font-bold text-emerald-700">
            💰 {hugeGap ? "🤯 That's a LOT of money! " : ''}You leave {formatCurrency(difference)} on the table
          </p>
        ) : (
          <p className="text-base font-semibold text-slate-700">Small gap. You're on the right track.</p>
        )}
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        *Projections are estimates, not guarantees. Past performance doesn't predict future results.
      </p>
    </section>
  );
}

function ProjectionPath({ title, subtitle, path, rate, color, progress }) {
  const start = path[0];
  const final = path.at(-1);
  const gain = final - start;
  const returnPercent = start > 0 ? Math.round((gain / start) * 100) : 0;
  const theme = color === 'green'
    ? {
        border: 'border-emerald-200',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        bar: 'bg-emerald-500',
        fill: '#10B981',
      }
    : {
        border: 'border-blue-200',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        bar: 'bg-blue-600',
        fill: '#2563EB',
      };

  return (
    <div className={`rounded-lg border ${theme.border} ${theme.bg} p-4`}>
      <div className="text-center">
        <p className={`text-xs font-bold uppercase tracking-[0.18em] ${theme.text}`}>{title}</p>
        <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
        <p className="mt-2 text-xs font-semibold text-slate-600">{rate}% assumed yearly growth</p>
      </div>

      <Histogram values={path} fill={theme.fill} />

      <div className="mt-3 space-y-2">
        {path.map((value, index) => (
          <div key={index} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
            <span className="text-xs font-medium text-slate-500">{index === 0 ? 'Start' : `Year ${index}`}</span>
            <AnimatedCurrency value={value} className="font-semibold text-slate-900" />
          </div>
        ))}
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full ${theme.bar} transition-all duration-700`} style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-4 border-t border-white/80 pt-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-slate-600">Gain</span>
          <AnimatedCurrency value={gain} prefix="+" className={`font-bold ${theme.text}`} />
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="font-semibold text-slate-600">Return</span>
          <span className={`font-bold ${theme.text}`}>{returnPercent}%</span>
        </div>
      </div>
    </div>
  );
}

function Histogram({ values, fill }) {
  const width = 260;
  const height = 150;
  const padding = { top: 16, right: 12, bottom: 34, left: 46 };
  const max = Math.max(...values);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const barGap = 5;
  const barWidth = (plotWidth - barGap * (values.length - 1)) / values.length;
  const yTicks = [max, max / 2, 0];

  return (
    <svg className="mt-4 h-[150px] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="5 year projection histogram">
      {yTicks.map((tick) => {
        const y = padding.top + plotHeight - (tick / max) * plotHeight;
        return (
          <g key={tick}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e2e8f0" />
            <text x={padding.left - 6} y={y + 4} textAnchor="end" className="fill-slate-500 text-[10px]">
              {formatCompactCurrency(tick)}
            </text>
          </g>
        );
      })}
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#94a3b8" />
      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#94a3b8" />
      {values.map((value, index) => {
        const barHeight = (value / max) * plotHeight;
        const x = padding.left + index * (barWidth + barGap);
        const y = padding.top + plotHeight - barHeight;
        return (
          <g key={index}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx="3" fill={fill} className="transition-all duration-700" />
            <text x={x + barWidth / 2} y={height - 18} textAnchor="middle" className="fill-slate-500 text-[10px]">
              {index === 0 ? 'Start' : `Y${index}`}
            </text>
          </g>
        );
      })}
      <text x={14} y={height / 2} textAnchor="middle" transform={`rotate(-90 14 ${height / 2})`} className="fill-slate-500 text-[10px]">
        Value
      </text>
      <text x={padding.left + plotWidth / 2} y={height - 3} textAnchor="middle" className="fill-slate-500 text-[10px]">
        Year
      </text>
    </svg>
  );
}

function formatCompactCurrency(value) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}k`;
  return formatCurrency(value);
}

function AnimatedCurrency({ value, prefix = '', className = '' }) {
  const animatedValue = useAnimatedNumber(value);

  return <span className={className}>{prefix}{formatCurrency(animatedValue)}</span>;
}

function useAnimatedNumber(value) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const startValue = displayValue;
    const difference = value - startValue;
    const startedAt = performance.now();
    const duration = 1000;
    let frameId;

    function tick(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + difference * eased);
      if (progress < 1) frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return roundToHundred(displayValue);
}

function buildProjection({ selectedGoal, selectedRisk, currentPortfolioValue, portfolio, targetAllocation }) {
  const base = Number(currentPortfolioValue) > 0 ? Number(currentPortfolioValue) : fallbackPortfolioValue;
  const profile = goalProfiles[selectedGoal] || goalProfiles.growth;
  const riskAdjustment = riskAdjustments[selectedRisk] ?? 0;
  const currentRate = clampRate(calculateCurrentPortfolioRate(portfolio));
  const recommendedBaseRate = calculateTargetAllocationRate(targetAllocation);
  const recommendedRate = clampRate(recommendedBaseRate + profile.tilt + riskAdjustment + getDiversificationLift(portfolio));

  return {
    goalLabel: profile.label,
    currentRate,
    recommendedRate,
    currentPath: projectPath(base, currentRate),
    recommendedPath: projectPath(base, recommendedRate),
  };
}

function calculateCurrentPortfolioRate(portfolio) {
  const holdings = Array.isArray(portfolio) ? portfolio : [];
  const total = holdings.reduce((sum, holding) => sum + getHoldingValue(holding), 0);
  if (total <= 0) return 5;

  return holdings.reduce((sum, holding) => {
    const weight = getHoldingValue(holding) / total;
    return sum + weight * getBucketRate(holding.bucket);
  }, 0);
}

function calculateTargetAllocationRate(targetAllocation) {
  const entries = Object.entries(targetAllocation || {});
  if (entries.length === 0) return 6;

  return entries.reduce((sum, [bucket, percent]) => {
    return sum + (Number(percent) / 100) * getBucketRate(bucket);
  }, 0);
}

function getDiversificationLift(portfolio) {
  const holdings = Array.isArray(portfolio) ? portfolio : [];
  const total = holdings.reduce((sum, holding) => sum + getHoldingValue(holding), 0);
  if (total <= 0) return 0;

  const singleStockPercent = holdings
    .filter(holding => holding.bucket === 'Single stocks')
    .reduce((sum, holding) => sum + getHoldingValue(holding), 0) / total * 100;

  return singleStockPercent > 20 ? 0.4 : 0.15;
}

function getBucketRate(bucket) {
  return bucketReturnAssumptions[bucket] ?? 5.5;
}

function getHoldingValue(holding) {
  const value = Number(holding?.value);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clampRate(rate) {
  return Math.round(Math.max(1.5, Math.min(12.5, rate)) * 10) / 10;
}

function projectPath(startValue, rate) {
  const values = [roundToHundred(startValue)];
  let balance = startValue;

  for (let year = 1; year <= 5; year += 1) {
    balance *= 1 + rate / 100;
    values.push(roundToHundred(balance));
  }

  return values;
}

function roundToHundred(value) {
  return Math.round(value / 100) * 100;
}
