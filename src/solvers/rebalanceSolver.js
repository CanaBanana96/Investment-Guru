import { targetMixes } from "../data/samplePortfolio.js";

export const scenarios = [
  {
    id: "market-drop",
    title: "Market drops 20%",
    plainText: "Stocks fall sharply and headlines feel scary.",
    emphasis: "stability",
  },
  {
    id: "high-inflation",
    title: "Inflation stays high",
    plainText: "Daily costs rise and cash loses buying power.",
    emphasis: "inflation",
  },
  {
    id: "withdrawal",
    title: "Need 20% next year",
    plainText: "A major purchase or life event needs cash soon.",
    emphasis: "liquidity",
  },
];

export function summarizePortfolio(holdings) {
  const safeHoldings = Array.isArray(holdings) ? holdings : [];
  const total = safeHoldings.reduce((sum, holding) => sum + getHoldingValue(holding), 0);
  const buckets = safeHoldings.reduce((acc, holding) => {
    const value = getHoldingValue(holding);
    if (value <= 0) return acc;
    acc[holding.bucket] = (acc[holding.bucket] || 0) + value;
    return acc;
  }, {});
  const allocation = Object.entries(buckets).map(([bucket, value]) => ({
    bucket,
    value,
    percent: total > 0 ? Math.round((value / total) * 100) : 0,
  }));
  const weightedRisk =
    total > 0
      ? safeHoldings.reduce((sum, holding) => sum + getHoldingRisk(holding) * getHoldingValue(holding), 0) / total
      : 0;
  const singleStockPercent = allocation.find((item) => item.bucket === "Single stocks")?.percent || 0;
  const healthScore =
    total > 0
      ? Math.max(52, Math.round(92 - weightedRisk * 4 - Math.max(0, singleStockPercent - 10) * 1.4))
      : 0;

  return {
    total,
    allocation,
    healthScore,
    singleStockPercent,
  };
}

function getHoldingValue(holding) {
  const value = Number(holding?.value);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getHoldingRisk(holding) {
  const risk = Number(holding?.risk);
  return Number.isFinite(risk) ? risk : 0;
}

export function buildRecommendation({ holdings, goal, comfort, cashNeed, scenarioId }) {
  const summary = summarizePortfolio(holdings);
  const target = targetMixes[comfort];
  const scenario = scenarios.find((item) => item.id === scenarioId) || scenarios[0];
  const steps = [];
  const explanations = [];

  if (summary.singleStockPercent > target["Single stocks"] + 5) {
    steps.push({
      label: "Lighten the single-stock load",
      detail: `Bring single stocks from ${summary.singleStockPercent}% closer to ${target["Single stocks"]}%. That gives the portfolio more breathing room.`,
    });
    explanations.push("One company can move a lot in a single week. A broad fund spreads that risk across many companies, so one bad headline hurts less.");
  }

  if (scenario.emphasis === "stability") {
    steps.push({
      label: "Add a steadier cushion",
      detail: `Move bonds toward ${target.Bonds}%. It can make red market days feel less dramatic.`,
    });
    explanations.push("Bonds are not magic, but they often soften the landing when stocks fall.");
  }

  if (scenario.emphasis === "inflation") {
    steps.push({
      label: "Keep cash purposeful",
      detail: `Keep cash near ${target.Cash}% once short-term needs are covered.`,
    });
    explanations.push("Inflation quietly shrinks idle cash, so every extra dollar should have a job.");
  }

  if (scenario.emphasis === "liquidity" || cashNeed > summary.total * 0.12) {
    steps.push({
      label: "Protect near-term cash first",
      detail: `Keep about ${formatCurrency(Math.max(cashNeed, summary.total * 0.2))} away from big market swings.`,
    });
    explanations.push("Money needed soon should not depend on next month's market mood.");
  }

  if (steps.length === 0) {
    steps.push({
      label: "Stay close, adjust gently",
      detail: "Your mix is already near your selected comfort zone.",
    });
    explanations.push("When the portfolio is already close, the wise move is small and steady.");
  }

  return {
    scenario,
    title: titleFor(goal, scenario.emphasis),
    confidence: summary.healthScore > 72 ? "High confidence" : "Medium confidence",
    costNote: estimateCosts(holdings, summary.singleStockPercent, target["Single stocks"]),
    steps,
    explanations,
    target,
    summary,
  };
}

function titleFor(goal, emphasis) {
  if (goal === "safety" || emphasis === "liquidity") return "make the portfolio safer first";
  if (goal === "income") return "make income steadier";
  if (emphasis === "inflation") return "keep cash working";
  return "reduce single-stock stress";
}

function estimateCosts(holdings, currentSingleStocks, targetSingleStocks) {
  const total = holdings.reduce((sum, holding) => sum + holding.value, 0);
  const tradeAmount = Math.max(0, ((currentSingleStocks - targetSingleStocks) / 100) * total);
  const spread = Math.round(tradeAmount * 0.003);
  if (tradeAmount === 0) {
    return "No sale required in the starter plan; confirm fund fees before adding money.";
  }
  return `${formatCurrency(spread)} estimated trading spread; review taxable gains before selling.`;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
