import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useLiveSamplePortfolio } from '../hooks/useLiveSamplePortfolio';
import { useMarketData } from '../hooks/useMarketData';
import { buildRecommendation, formatCurrency } from '../solvers/rebalanceSolver';
import { signOutUser } from '../services/auth';
import FixPortfolio from './FixPortfolio';
import LivePortfolioTracker from './LivePortfolioTracker';
import StockInspector from './StockInspector';
import ThisVsThat from './ThisVsThat';
import TopStocksTracker from './TopStocksTracker';

const statsRanges = [
  { id: '1d', label: '1D' },
  { id: '3d', label: '3D' },
  { id: '7d', label: '7D' },
  { id: '1m', label: '1M' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
  { id: '1y', label: '1Y' },
];

const goalOptions = [
  { id: 'buy-home', emoji: '🏠', title: 'Buy a home' },
  { id: 'education', emoji: '📚', title: "Child's education" },
  { id: 'retire-early', emoji: '🌴', title: 'Retire early' },
  { id: 'grow-wealth', emoji: '📈', title: 'Grow wealth' },
  { id: 'protect-savings', emoji: '🛡️', title: 'Protect savings' },
  { id: 'regular-income', emoji: '💵', title: 'Regular income' },
];

const riskOptions = [
  { id: 'low', title: 'Low Risk', selectedClass: 'border-green-600 bg-green-600 text-white shadow-sm' },
  { id: 'medium', title: 'Medium Risk', selectedClass: 'border-yellow-500 bg-yellow-500 text-white shadow-sm' },
  { id: 'high', title: 'High Risk', selectedClass: 'border-red-600 bg-red-600 text-white shadow-sm' },
];

const scenarioOptions = ['Market drops 20%', 'Inflation stays high', 'Need 20% next year'];

const scenarioByGoal = {
  'buy-home': 'Need 20% next year',
  education: 'Need 20% next year',
  'retire-early': 'Market drops 20%',
  'grow-wealth': 'Market drops 20%',
  'protect-savings': 'Inflation stays high',
  'regular-income': 'Inflation stays high',
};

const healthTargets = {
  'buy-home': 75,
  education: 78,
  'retire-early': 82,
  'grow-wealth': 80,
  'protect-savings': 70,
  'regular-income': 73,
};

const recommendationByGoal = {
  'buy-home': {
    title: '🏠 Save for your down payment',
    actions: ['Move 30% to cash/money market', 'Keep remaining in conservative bonds'],
    why: 'You need this money in 1-3 years. Growth is nice, but safety matters more.',
  },
  education: {
    title: '📚 Education fund strategy',
    actions: ['Set up 529-plan compatible allocation', 'Glide path: aggressive now, conservative in 5 years'],
    why: "College is 5+ years away. You have time to grow, but we'll protect as you get closer.",
  },
  'retire-early': {
    title: '🌴 Early retirement path',
    actions: ['Increase equity exposure to 75%', 'Focus on dividend growth stocks'],
    why: "You need growth to retire early. Short-term drops don't matter. Long-term compounding does.",
  },
  'grow-wealth': {
    title: '📈 Wealth building mode',
    actions: ['Add 10% to emerging markets', 'Rebalance quarterly to capture gains'],
    why: "You want growth. We'll stay aggressive but rebalance to lock in profits.",
  },
  'protect-savings': {
    title: '🛡️ Capital preservation',
    actions: ['Move to 50% bonds, 30% cash, 20% stocks', 'Avoid single stocks entirely'],
    why: "Your priority is not losing money. We'll keep you safe.",
  },
  'regular-income': {
    title: '💵 Monthly income focus',
    actions: ['Add dividend ETFs (SCHD, VYM)', 'Add bond ladder for predictable payments'],
    why: "You want cash flow. We'll build a portfolio that pays you monthly.",
  },
};

const riskEffects = {
  low: {
    text: 'Prioritize bonds (50-60%)',
    targetAdjustment: 5,
    greeting: 'Low risk means sleeping well at night. Bonds are your friend.',
  },
  medium: {
    text: 'Balanced approach (60% stocks / 40% bonds)',
    targetAdjustment: 0,
    greeting: 'Medium risk. Growth with a safety net. This works for most.',
  },
  high: {
    text: 'Aggressive growth (80-90% stocks)',
    targetAdjustment: -3,
    greeting: "High risk, high reward. You'll see bigger swings. Don't panic.",
  },
};

const guruGreetingByGoal = {
  'buy-home': "Beta, saving for a home? Let's keep your down payment safe. Tap 'Show me' for a conservative plan.",
  education: "Beta, saving for college? We'll balance growth and safety as the date approaches.",
  'retire-early': "Beta, retiring early takes discipline. I'll keep you aggressive but smart.",
  'grow-wealth': "Beta, let's build wealth. I'll push for growth without letting you take unnecessary risks.",
  'protect-savings': "Beta, safety first. I'll protect your capital while beating inflation.",
  'regular-income': 'Beta, want monthly cash? Let me show you dividend stocks and bond ladders.',
};

export default function Dashboard({ initialGoal = 'growth', initialRisk = 'medium' }) {
  const { user, isGuest, exitGuest } = useAuth();
  const navigate = useNavigate();
  const { portfolio, loading: portfolioLoading, error: portfolioError, lastUpdated } = useLiveSamplePortfolio();
  const marketData = useMarketData();
  const [goal, setGoal] = useState(() => normalizeGoal(initialGoal));
  const [comfort, setComfort] = useState(initialRisk);
  const [recommendationPulse, setRecommendationPulse] = useState(false);
  const cashNeed = 8000;
  const [selectedHoldingSymbol, setSelectedHoldingSymbol] = useState('');
  const [showAllHoldings, setShowAllHoldings] = useState(false);
  const [openWhy, setOpenWhy] = useState(null);
  const [feePopup, setFeePopup] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: 'Beta, I loaded live prices for your guest demo portfolio. Want to review the risk?\nButtons: [Show me] [Later]',
    },
  ]);
  const chatMessagesRef = useRef(null);

  const recommendation = useMemo(
    () =>
      buildRecommendation({
        holdings: portfolio,
        goal,
        comfort,
        cashNeed,
        scenarioId: 'market-drop',
      }),
    [portfolio, goal, comfort, cashNeed]
  );
  const { summary, target } = recommendation;
  const selectedGoalContent = recommendationByGoal[goal] || recommendationByGoal['grow-wealth'];
  const selectedRiskEffect = riskEffects[comfort] || riskEffects.medium;
  const selectedScenario = scenarioByGoal[goal] || scenarioByGoal['grow-wealth'];
  const healthTarget = (healthTargets[goal] || healthTargets['grow-wealth']) + selectedRiskEffect.targetAdjustment;
  const transparency = useMemo(() => buildTransparencyModel(summary, target), [summary, target]);
  const portfolioReturn = useMemo(() => calculateSeedReturn(portfolio), [portfolio]);
  const stockHoldings = useMemo(
    () =>
      portfolio
        .filter(holding => holding.type === 'Stock')
        .sort((a, b) => (b.livePercentChange ?? -Infinity) - (a.livePercentChange ?? -Infinity)),
    [portfolio]
  );
  const selectedHolding = stockHoldings.find(holding => holding.symbol === selectedHoldingSymbol) || stockHoldings[0];
  const visibleHoldings = showAllHoldings ? portfolio : portfolio.slice(0, 3);

  useEffect(() => {
    if (!selectedHoldingSymbol && stockHoldings[0]) {
      setSelectedHoldingSymbol(stockHoldings[0].symbol);
      return;
    }

    if (selectedHoldingSymbol && !stockHoldings.some(holding => holding.symbol === selectedHoldingSymbol)) {
      setSelectedHoldingSymbol(stockHoldings[0]?.symbol || '');
    }
  }, [selectedHoldingSymbol, stockHoldings]);

  useEffect(() => {
    const el = chatMessagesRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [chatMessages, chatBusy]);

  useEffect(() => {
    setChatMessages([
      {
        role: 'assistant',
        content: `${guruGreetingByGoal[goal] || guruGreetingByGoal['grow-wealth']} ${selectedRiskEffect.greeting}\nButtons: [Show me] [Explain simply]`,
      },
    ]);
  }, [goal, selectedRiskEffect.greeting]);

  useEffect(() => {
    setRecommendationPulse(true);
    const timeoutId = window.setTimeout(() => setRecommendationPulse(false), 700);
    return () => window.clearTimeout(timeoutId);
  }, [comfort, goal]);

  const parseMessage = (content) => {
    const lines = content.split('\n');
    const buttonsLine = lines.find(line => line.startsWith('Buttons:'));
    const text = lines.filter(line => !line.startsWith('Buttons:')).join('\n');
    const buttons = buttonsLine ? buttonsLine.replace('Buttons:', '').trim().match(/\[[^\]]+\]/g)?.map(b => b.slice(1, -1)) || [] : [];
    return { text, buttons };
  };

  const submitGuruJiMessage = async (message) => {
    const cleanMessage = message.trim();
    if (!cleanMessage || chatBusy) return;

    const nextMessages = [...chatMessages, { role: 'user', content: cleanMessage }];
    setChatMessages([...nextMessages, { role: 'assistant', content: 'Thinking...' }]);
    setChatInput('');
    setChatBusy(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanMessage,
          history: nextMessages,
          portfolio: {
            holdings: portfolio,
            summary,
            liveMarket: {
              lastUpdated,
              broadMarket: marketData,
              topMover: stockHoldings[0]
                ? {
                    symbol: stockHoldings[0].symbol,
                    price: stockHoldings[0].currentPrice,
                    percentChange: stockHoldings[0].livePercentChange,
                    value: stockHoldings[0].value,
                  }
                : null,
              stockMoves: stockHoldings.map(holding => ({
                symbol: holding.symbol,
                price: holding.currentPrice,
                percentChange: holding.livePercentChange,
                dollarChange: holding.liveChange,
                value: holding.value,
              })),
            },
            goal,
            comfort,
            cashNeed,
            selectedGoalContent,
            selectedRiskEffect,
            selectedScenario,
            healthTarget,
            scenario: recommendation.scenario,
            recommendation: {
              title: recommendation.title,
              steps: recommendation.steps,
              explanations: recommendation.explanations,
              costNote: recommendation.costNote,
            },
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Guru-Ji could not respond.');
      setChatMessages([...nextMessages, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      setChatMessages([...nextMessages, { role: 'assistant', content: error.message }]);
    } finally {
      setChatBusy(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (isGuest) {
        exitGuest();
        toast.success('Guest session ended');
      } else {
        await signOutUser();
        toast.success('You have been signed out successfully');
      }
      navigate('/', { replace: true });
    } catch {
      toast.error('Unable to sign out. Please try again.');
    }
  };

  const primaryStep = recommendation.steps[0];
  const focusPortfolioImpact = () => {
    window.setTimeout(() => {
      document.getElementById('portfolio-impact-summary')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 50);
  };
  const handleGoalChange = (nextGoal) => {
    setGoal(nextGoal);
    focusPortfolioImpact();
  };
  const handleRiskChange = (nextRisk) => {
    setComfort(nextRisk);
    focusPortfolioImpact();
  };
  const resetChoices = () => {
    setGoal('grow-wealth');
    setComfort('medium');
    focusPortfolioImpact();
  };

  return (
    <div className="min-h-screen bg-[#f6f3ec] text-slate-950">
      <header className="border-b border-teal-900/10 bg-white/90 shadow-sm shadow-teal-950/5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">INVESTMENT GURU</p>
            <h1 className="mt-2 text-2xl font-semibold">Portfolio guide</h1>
            <p className="mt-1 text-sm text-slate-600">
              {isGuest ? 'Guest mode using live demo market data.' : `Signed in as ${user?.email}`}
            </p>
            <p className="mt-1 text-xs font-medium text-teal-700">
              {portfolioLoading
                ? 'Loading live demo prices...'
                : lastUpdated
                  ? `Live demo prices updated ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                  : 'Using fallback demo prices'}
            </p>
            {portfolioError && <p className="mt-1 text-xs font-medium text-amber-700">Live quotes unavailable; fallback demo prices are shown.</p>}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex h-11 items-center justify-center rounded-md bg-teal-900 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            {isGuest ? 'Exit guest mode' : 'Sign out'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="space-y-5 rounded-lg border border-teal-900/10 bg-white p-5 shadow-sm shadow-teal-950/5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Our portfolio</p>
              <h2 className="mt-1 text-xl font-semibold">Guest demo portfolio</h2>
              <p className="mt-1 text-sm text-slate-600">This portfolio uses live API prices for stock holdings and fallback values for funds.</p>
            </div>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
              {portfolio.some(holding => holding.isLive) ? 'Live stock data active' : 'Fallback data active'}
            </span>
          </div>

          <GoalRiskSelector
            selectedGoal={goal}
            selectedRisk={comfort}
            selectedScenario={selectedScenario}
            selectedGoalContent={selectedGoalContent}
            selectedRiskEffect={selectedRiskEffect}
            healthTarget={healthTarget}
            onGoalChange={handleGoalChange}
            onRiskChange={handleRiskChange}
            onReset={resetChoices}
          />

          <div id="portfolio-impact-summary" className="grid gap-4 sm:grid-cols-3">
            <PortfolioValueMetric
              value={formatCurrency(summary.total)}
              portfolioReturn={portfolioReturn}
            />
            <Metric label="Health score" value={`${summary.healthScore}/100`} detail={`Target: ${healthTarget}`} />
            <Metric label="Single-stock exposure" value={`${summary.singleStockPercent}%`} />
          </div>

          <div className="grid gap-4 rounded-lg border border-teal-900/10 bg-[#fbfaf7] p-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <label className="text-sm font-medium text-slate-700">
              Current holding stocks
              <select
                value={selectedHolding?.symbol || ''}
                onChange={(event) => setSelectedHoldingSymbol(event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-teal-900/20 bg-white px-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-amber-200"
              >
                {stockHoldings.map((holding, index) => (
                  <option key={holding.symbol} value={holding.symbol}>
                    {index + 1}. {holding.symbol} {formatSignedPercent(holding.livePercentChange)}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Ranked from highest live growth to lowest.
              </p>
            </label>
            {selectedHolding && (
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat label="Selected stock" value={selectedHolding.symbol} detail={selectedHolding.name} />
                <MiniStat label="Live change" value={formatSignedPercent(selectedHolding.livePercentChange)} detail="Current session" />
                <MiniStat label="Portfolio effect" value={formatCurrency(selectedHolding.value)} detail={`${getHoldingPercent(selectedHolding, summary.total)}% of portfolio`} />
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-teal-900/10">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-[#fbfaf7] text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Holding</th>
                  <th className="px-4 py-3 font-semibold">Live status</th>
                  <th className="px-4 py-3 text-right font-semibold">Price</th>
                  <th className="px-4 py-3 text-right font-semibold">Value</th>
                  <th className="px-4 py-3 text-right font-semibold">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {visibleHoldings.map((holding) => (
                  <tr key={holding.symbol}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{holding.symbol}</div>
                      <div className="text-slate-500">
                        {holding.name}
                        {holding.type === 'Stock' && holding.shares ? ` - ${holding.shares} shares` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        holding.type === 'Stock'
                          ? holding.isLive
                            ? 'bg-teal-50 text-teal-800'
                            : 'bg-amber-50 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                      >
                        {holding.type === 'Stock' ? (holding.isLive ? 'Live API' : 'Fallback') : 'Fund value'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{holding.currentPrice ? formatCurrency(holding.currentPrice) : '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(holding.value)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${(holding.livePercentChange || 0) >= 0 ? 'text-teal-700' : 'text-red-700'}`}>
                      {holding.type === 'Stock' && holding.livePercentChange != null ? `${holding.livePercentChange >= 0 ? '+' : ''}${holding.livePercentChange.toFixed(2)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {portfolio.length > 3 && (
              <div className="flex items-center justify-between gap-3 border-t border-teal-900/10 bg-[#fbfaf7] px-4 py-3">
                <p className="text-sm text-slate-600">
                  Showing {visibleHoldings.length} of {portfolio.length} holdings
                </p>
                <button
                  type="button"
                  onClick={() => setShowAllHoldings(current => !current)}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-teal-900/20 bg-white px-3 text-sm font-semibold text-teal-800 transition hover:bg-amber-50"
                >
                  {showAllHoldings ? 'Show fewer' : `Show ${portfolio.length - 3} more`}
                </button>
              </div>
            )}
          </div>

          <StatsBoard portfolio={portfolio} summary={summary} />

          <LivePortfolioTracker portfolio={portfolio} />
        </section>

        <StockInspector portfolio={portfolio} />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <section className="rounded-lg border border-teal-900/10 bg-white p-5 shadow-sm shadow-teal-950/5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Guru-Ji</p>
                  <h2 className="mt-1 text-lg font-semibold">Ask about the plan or your portfolio</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Market context: VIX {marketData.vix.toFixed(1)} · S&P 500 {marketData.sp500} · {marketData.fearLevel}
                  </p>
                </div>
                {chatBusy && <span className="text-sm font-medium text-slate-500">Thinking</span>}
              </div>
              <div ref={chatMessagesRef} className="mt-4 flex max-h-80 flex-col gap-3 overflow-y-auto rounded-lg border border-teal-900/10 bg-[#fbfaf7] p-3">
                {chatMessages.map((message, index) => {
                  const { text, buttons } = parseMessage(message.content);
                  return (
                    <div key={`${message.role}-${index}`}>
                      <div className={`rounded-lg px-3 py-2 text-sm ${message.role === 'user' ? 'ml-6 bg-teal-900 text-white' : 'mr-6 border border-teal-900/10 bg-white text-slate-700'}`}>
                        <p className={`mb-1 text-xs font-semibold ${message.role === 'user' ? 'text-slate-300' : 'text-slate-500'}`}>{message.role === 'user' ? 'You' : 'Guru-Ji'}</p>
                        <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
                      </div>
                      {buttons.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 mr-6">
                          {buttons.map((btn, btnIndex) => (
                            <button key={btnIndex} type="button" onClick={() => setChatInput(btn)} className="inline-flex h-8 items-center justify-center rounded-md bg-teal-900 px-3 text-xs font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-amber-300">
                              {btn}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <form onSubmit={(event) => { event.preventDefault(); submitGuruJiMessage(chatInput); }} className="mt-4 space-y-3">
                <label className="sr-only" htmlFor="coachMessage">Ask Guru-Ji</label>
                <textarea
                  id="coachMessage"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      submitGuruJiMessage(chatInput);
                    }
                  }}
                  rows={3}
                  placeholder="Ask about live moves, a holding, portfolio risk, or next steps..."
                  className="w-full resize-none rounded-md border border-teal-900/20 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-amber-200"
                />
                <button type="submit" disabled={chatBusy || !chatInput.trim()} className="inline-flex h-10 w-full items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-50">Send message</button>
              </form>
            </section>

            <FixPortfolio portfolio={portfolio} selectedGoal={goal} selectedRisk={comfort} />

            <ThisVsThat
              selectedGoal={goal}
              selectedRisk={comfort}
              currentPortfolioValue={summary.total}
              portfolio={portfolio}
              targetAllocation={target}
            />

            <TopStocksTracker />
          </div>

          <aside className="space-y-6">
            <section id="recommendation-panel" className={`scroll-mt-6 rounded-lg border border-teal-900/10 bg-white p-5 shadow-sm shadow-teal-950/5 transition duration-500 ${recommendationPulse ? 'ring-4 ring-amber-200' : ''}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Recommendation</p>
              <h2 className="mt-2 text-xl font-semibold">{selectedGoalContent.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {selectedGoalContent.why}
              </p>
              <p className="mt-2 text-sm font-medium text-teal-700">{selectedRiskEffect.text}</p>
              <div id="recommendation-primary-action" className="mt-5 rounded-lg border border-teal-900/10 bg-[#fbfaf7] p-4 transition duration-500">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Action 1</p>
                <RecommendationAction
                  action={selectedGoalContent.actions[0]}
                  explanation={transparency.singleStockExplanation}
                  isOpen={openWhy === 'action-1'}
                  onToggle={() => setOpenWhy(openWhy === 'action-1' ? null : 'action-1')}
                  onClose={() => setOpenWhy(null)}
                />
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-teal-700">Action 2</p>
                <RecommendationAction
                  action={selectedGoalContent.actions[1]}
                  explanation={transparency.bondExplanation}
                  isOpen={openWhy === 'action-2'}
                  onToggle={() => setOpenWhy(openWhy === 'action-2' ? null : 'action-2')}
                  onClose={() => setOpenWhy(null)}
                />
              </div>
              <div className="mt-3 rounded-lg border border-teal-900/10 bg-white p-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">Why this matters:</span> a beginner-friendly plan should explain what you own, what can hurt you, and what one small action improves.
              </div>
              {primaryStep && (
                <div className="mt-3 rounded-lg border border-teal-900/10 bg-white p-3 text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">Engine note:</span> {primaryStep.label}
                  <p className="mt-1 text-xs leading-5 text-slate-500">{primaryStep.detail}</p>
                </div>
              )}
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{recommendation.costNote}</p>
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-900">
                🛡️ We don't have hidden fees or conflicts of interest. Ever.
              </div>
            </section>

            <FeeTaxExplainer
              transparency={transparency}
              activePopup={feePopup}
              onPopupChange={setFeePopup}
            />

            <section className="rounded-lg border border-teal-900/10 bg-white p-5 shadow-sm shadow-teal-950/5">
              <h2 className="text-lg font-semibold">Allocation vs target</h2>
              <div className="mt-4 space-y-4">
                {summary.allocation.map((item) => (
                  <div key={item.bucket}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{item.bucket}</span>
                      <span className="text-slate-600">{item.percent}% / {target[item.bucket]}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-teal-600" style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>

      </main>
    </div>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div className="rounded-lg border border-teal-900/10 bg-white p-5 shadow-sm shadow-teal-950/5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {detail && <p className="mt-2 text-sm font-semibold text-teal-700">{detail}</p>}
    </div>
  );
}

function GoalRiskSelector({ selectedGoal, selectedRisk, selectedScenario, selectedGoalContent, selectedRiskEffect, healthTarget, onGoalChange, onRiskChange, onReset }) {
  return (
    <section className="rounded-lg border border-teal-900/10 bg-[#fbfaf7] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Portfolio goals</p>
          <h3 className="mt-1 text-lg font-semibold">First choose the portfolio goal, then the risk level</h3>
          <p className="mt-1 text-sm text-slate-600">The portfolio metrics below update first, then the scenario, recommendation, Guru-Ji, and projection follow that choice.</p>
        </div>
        <button type="button" onClick={onReset} className="self-start text-sm font-semibold text-teal-700 underline-offset-4 hover:underline">
          Clear choices
        </button>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="grid min-w-[840px] grid-cols-6 gap-3 md:min-w-0">
          {goalOptions.map(option => {
            const selected = selectedGoal === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onGoalChange(option.id)}
                className={`relative rounded-lg border bg-white p-4 text-left transition ${
                  selected
                    ? 'border-green-600 shadow-md shadow-green-900/10'
                    : 'border-teal-900/10 hover:border-teal-700/40 hover:bg-amber-50'
                }`}
              >
                {selected && (
                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">
                    ✓
                  </span>
                )}
                <span className="block text-2xl">{option.emoji}</span>
                <span className="mt-2 block text-sm font-semibold text-slate-900">{option.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {riskOptions.map(option => {
            const selected = selectedRisk === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onRiskChange(option.id)}
                className={`h-10 rounded-md border px-4 text-sm font-semibold transition ${
                  selected
                    ? option.selectedClass
                    : 'border-teal-900/10 bg-white text-slate-700 hover:bg-amber-50'
                }`}
              >
                {option.title}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {scenarioOptions.map(scenario => (
            <span
              key={scenario}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                selectedScenario === scenario
                  ? 'bg-teal-900 text-white'
                  : 'bg-white text-slate-500'
              }`}
            >
              {scenario}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-lg border border-teal-900/10 bg-white p-3 md:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">1. Portfolio target</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">Health target: {healthTarget}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">2. Risk behavior</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{selectedRiskEffect.text}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">3. Next portfolio move</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{selectedGoalContent.actions[0]}</p>
        </div>
      </div>
    </section>
  );
}

function RecommendationAction({ action, explanation, isOpen, onToggle, onClose }) {
  return (
    <div className="relative mt-1">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{action}</p>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 transition hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
          aria-label={`Why ${action}`}
        >
          ?
        </button>
      </div>
      {isOpen && (
        <div className="absolute right-0 top-9 z-30 w-80 max-w-[calc(100vw-3rem)] rounded-lg bg-[#EFF6FF] p-4 text-sm shadow-xl shadow-slate-950/10 ring-1 ring-blue-100">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-slate-900">🔍 Why this move?</p>
            <button type="button" onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-slate-900">
              X
            </button>
          </div>
          <div className="mt-3 space-y-3 text-slate-700">
            <p><span className="font-semibold text-slate-900">Plain English:</span> {explanation.plain}</p>
            <p><span className="font-semibold text-slate-900">Math behind it:</span> {explanation.math}</p>
            <p><span className="font-semibold text-slate-900">Historical proof:</span> {explanation.proof}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FeeTaxExplainer({ transparency, activePopup, onPopupChange }) {
  const value = transparency.total;
  const newValue = value - transparency.taxes - transparency.tradingFees;

  return (
    <section className="rounded-lg border border-teal-900/10 bg-white p-5 shadow-sm shadow-teal-950/5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Fee & tax explainer</p>
      <h2 className="mt-1 text-lg font-semibold">💰 Where Your Money Goes</h2>
      <p className="mt-2 text-sm text-slate-600">When you click "Make My Portfolio Safer":</p>

      <div className="mt-4 rounded-lg border border-teal-900/10 bg-[#fbfaf7] p-4 text-sm">
        <p className="font-semibold text-slate-900">Your portfolio: {formatCurrency(value)}</p>
        <FlowStep text={`Step 1: Sell concentrated stock exposure (${formatCurrency(transparency.estimatedGain)} estimated gains)`} />
        <FlowStep text={`Taxes you owe: ~${formatCurrency(transparency.taxes)} (${Math.round(transparency.taxRate * 100)}% of estimated gains)`} />
        <FlowStep text="Step 2: Buy broad funds + bonds" />
        <FlowStep text={`Trading fees: ~${formatCurrency(transparency.tradingFees)} one-time`} />
        <FlowStep text={`Step 3: Ongoing yearly fees: ~${formatCurrency(transparency.yearlyFees)} (${transparency.yearlyFeeRate}% of portfolio)`} />
      </div>

      <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-950">
        New portfolio: {formatCurrency(value)} - {formatCurrency(transparency.taxes)} - {formatCurrency(transparency.tradingFees)} = {formatCurrency(newValue)}
        <span className="mt-1 block text-xs font-medium text-blue-800">Estimated recovery: ~{transparency.recoveryMonths} months through lower expected losses.</span>
      </p>

      <div className="mt-4 rounded-lg border border-teal-900/10 bg-white p-3">
        <p className="text-sm font-semibold text-slate-900">📋 What you pay for</p>
        <div className="mt-2 space-y-1 text-xs text-slate-600">
          <p>• Taxes → Government (you can't avoid this)</p>
          <p>• Trading fees → Brokerage execution</p>
          <p>• No hidden fees → We don't take commissions</p>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onPopupChange(activePopup === 'tax' ? null : 'tax')}
          className="rounded-md border border-teal-900/20 bg-white px-3 py-2 text-sm font-semibold text-teal-800 transition hover:bg-amber-50"
        >
          💡 Tax-saving tip
        </button>
        <button
          type="button"
          onClick={() => onPopupChange(activePopup === 'compare' ? null : 'compare')}
          className="rounded-md border border-teal-900/20 bg-white px-3 py-2 text-sm font-semibold text-teal-800 transition hover:bg-amber-50"
        >
          🔍 Compare options
        </button>

        {activePopup === 'tax' && (
          <PopupPanel onClose={() => onPopupChange(null)}>
            Hold investments for 1+ year → pay 0-15% instead of 25-35% on gains.
          </PopupPanel>
        )}

        {activePopup === 'compare' && (
          <PopupPanel onClose={() => onPopupChange(null)} wide>
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1"> </th>
                  <th className="py-1">Current</th>
                  <th className="py-1">Recommended</th>
                  <th className="py-1">Difference</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr><td className="py-1 font-semibold">Fees/year</td><td>$0</td><td>{formatCurrency(transparency.yearlyFees)}</td><td>+{formatCurrency(transparency.yearlyFees)}</td></tr>
                <tr><td className="py-1 font-semibold">Tax efficiency</td><td>Poor</td><td>Good</td><td>Better</td></tr>
                <tr><td className="py-1 font-semibold">Crash protection</td><td>Low</td><td>High</td><td>+{formatCurrency(transparency.crashSavings)} saved</td></tr>
              </tbody>
            </table>
          </PopupPanel>
        )}
      </div>

      <p className="mt-4 rounded-lg border border-teal-900/10 bg-[#fbfaf7] p-3 text-sm font-semibold text-slate-800">
        🏦 We don't get paid by fund companies. Our only job is helping you.
      </p>
    </section>
  );
}

function FlowStep({ text }) {
  return (
    <div className="mt-3">
      <p className="text-center text-slate-400">↓</p>
      <p className="rounded-md bg-white p-2 font-medium text-slate-700">{text}</p>
    </div>
  );
}

function PopupPanel({ children, onClose, wide = false }) {
  return (
    <div className={`absolute left-0 top-12 z-30 rounded-lg bg-[#EFF6FF] p-4 shadow-xl shadow-slate-950/10 ring-1 ring-blue-100 ${wide ? 'w-[360px] max-w-[calc(100vw-3rem)]' : 'w-72'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium leading-6 text-slate-700">{children}</div>
        <button type="button" onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-slate-900">X</button>
      </div>
    </div>
  );
}

function PortfolioValueMetric({ value, portfolioReturn }) {
  const isPositive = portfolioReturn.change >= 0;
  const trendColor = isPositive ? 'text-teal-700' : 'text-red-700';
  const trendBg = isPositive ? 'bg-teal-50 border-teal-100' : 'bg-red-50 border-red-100';
  const sign = isPositive ? '+' : '';

  return (
    <div className="relative rounded-lg border border-teal-900/10 bg-white p-5 shadow-sm shadow-teal-950/5">
      <p className="text-sm font-medium text-slate-500">Portfolio value</p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        <div className="group relative">
          <button
            type="button"
            className={`inline-flex h-8 items-center rounded-full border px-3 text-sm font-semibold ${trendBg} ${trendColor} focus:outline-none focus:ring-2 focus:ring-amber-200`}
            aria-describedby="portfolio-return-tooltip"
          >
            {sign}{portfolioReturn.percent.toFixed(2)}%
          </button>
          <div
            id="portfolio-return-tooltip"
            role="tooltip"
            className="pointer-events-none absolute left-0 top-10 z-20 hidden w-80 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-xl shadow-slate-950/10 group-hover:block group-focus-within:block"
          >
            <p className="text-sm font-semibold text-slate-900">{portfolioReturn.summary}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Seed money: {formatCurrency(portfolioReturn.seedTotal)}. Change: {formatCurrency(portfolioReturn.change)}.
            </p>
            <div className="mt-3 space-y-2">
              {portfolioReturn.drivers.map(driver => (
                <div key={driver.symbol} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-slate-800">{driver.symbol}</span>
                  <span className={driver.change >= 0 ? 'font-semibold text-teal-700' : 'font-semibold text-red-700'}>
                    {driver.change >= 0 ? '+' : ''}{formatCurrency(driver.change)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, detail, tone = 'default' }) {
  const valueColor = tone === 'positive' ? 'text-teal-700' : tone === 'negative' ? 'text-red-700' : 'text-slate-900';

  return (
    <div className="rounded-lg border border-teal-900/10 bg-white p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${valueColor}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function StatsBoard({ portfolio, summary }) {
  const [selectedRange, setSelectedRange] = useState('1d');
  const [rangeHistories, setRangeHistories] = useState({});
  const [rangeLoading, setRangeLoading] = useState(false);
  const stockHoldings = useMemo(() => portfolio.filter(holding => holding.type === 'Stock'), [portfolio]);
  const stockSymbols = useMemo(() => stockHoldings.map(holding => holding.symbol).join(','), [stockHoldings]);
  const riskScore = Math.max(0, Math.min(100, 100 - summary.healthScore));
  const topMover = [...stockHoldings].sort(
    (a, b) => Math.abs(b.livePercentChange || 0) - Math.abs(a.livePercentChange || 0)
  )[0];
  const biggestPosition = [...portfolio].sort((a, b) => b.value - a.value)[0];
  const portfolioReturn = useMemo(() => calculateSeedReturn(portfolio), [portfolio]);
  const rangeRows = useMemo(
    () => stockHoldings.map(holding => calculateRangeReturn(holding, rangeHistories[holding.symbol])),
    [rangeHistories, stockHoldings]
  );
  const rangeChange = rangeRows.reduce((sum, row) => sum + row.change, 0);
  const rangeStartValue = rangeRows.reduce((sum, row) => sum + row.startValue, 0);
  const rangePercent = rangeStartValue > 0 ? (rangeChange / rangeStartValue) * 100 : 0;
  const selectedRangeLabel = statsRanges.find(range => range.id === selectedRange)?.label || selectedRange.toUpperCase();

  useEffect(() => {
    let isMounted = true;

    async function loadRangeHistories() {
      if (stockHoldings.length === 0) return;
      setRangeLoading(true);
      try {
        const responses = await Promise.all(
          stockHoldings.map(async (holding) => {
            const response = await fetch(`/api/stock/${encodeURIComponent(holding.symbol)}/history?range=${selectedRange}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Unable to load ${holding.symbol} history.`);
            return [holding.symbol, data];
          })
        );

        if (isMounted) setRangeHistories(Object.fromEntries(responses));
      } catch {
        if (isMounted) setRangeHistories({});
      } finally {
        if (isMounted) setRangeLoading(false);
      }
    }

    loadRangeHistories();
    return () => {
      isMounted = false;
    };
  }, [selectedRange, stockSymbols, stockHoldings]);

  return (
    <section className="rounded-lg border border-teal-900/10 bg-[#fbfaf7] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Stats board</p>
          <h3 className="mt-1 text-lg font-semibold">Portfolio makeup and live stock impact</h3>
        </div>
        <div className="flex flex-wrap gap-1">
          {statsRanges.map(range => (
            <button
              key={range.id}
              type="button"
              onClick={() => setSelectedRange(range.id)}
              className={`h-8 rounded-md px-2 text-xs font-semibold transition ${
                selectedRange === range.id
                  ? 'bg-teal-900 text-white'
                  : 'bg-white text-slate-700 hover:bg-amber-50'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="rounded-lg border border-teal-900/10 bg-white p-4">
          <PortfolioPieChart holdings={portfolio} total={summary.total} />
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat
              label="Top live mover"
              value={topMover ? topMover.symbol : '-'}
              detail={topMover ? `${formatSignedPercent(topMover.livePercentChange)} today` : 'No live stock data'}
            />
            <MiniStat
              label="Largest position"
              value={biggestPosition ? biggestPosition.symbol : '-'}
              detail={biggestPosition ? `${getHoldingPercent(biggestPosition, summary.total)}% of portfolio` : 'No holdings'}
            />
            <MiniStat
              label="Stock exposure"
              value={`${summary.singleStockPercent}%`}
              detail="Single-stock share of portfolio"
            />
            <MiniStat
              label="Since seed"
              value={`${portfolioReturn.change >= 0 ? '+' : ''}${portfolioReturn.percent.toFixed(2)}%`}
              detail={`${portfolioReturn.change >= 0 ? '+' : ''}${formatCurrency(portfolioReturn.change)}`}
              tone={portfolioReturn.change >= 0 ? 'positive' : 'negative'}
            />
          </div>

          <RiskMeter
            label="Portfolio risk"
            score={riskScore}
            tone={riskScore > 55 ? 'high' : riskScore > 32 ? 'medium' : 'low'}
            description={riskScore > 55 ? 'High concentration needs attention.' : riskScore > 32 ? 'Balanced, but watch single-stock swings.' : 'Lower risk for this demo mix.'}
          />

          <div className="rounded-lg border border-teal-900/10 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-teal-900/10 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stock P/L over {selectedRangeLabel}</p>
              {rangeLoading && <span className="text-xs font-semibold text-slate-400">Loading</span>}
            </div>
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-teal-900/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Stock</span>
              <span>Value</span>
              <span>Today</span>
              <span>{selectedRangeLabel}</span>
            </div>
            {rangeRows.map(row => (
              <div key={row.symbol} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-2 text-sm">
                <span>
                  <span className="font-semibold text-slate-900">{row.symbol}</span>
                  <span className="ml-2 text-slate-500">{row.name}</span>
                </span>
                <span className="text-right font-medium text-slate-700">{formatCurrency(row.currentValue)}</span>
                <span className={`text-right font-semibold ${row.dailyChange >= 0 ? 'text-teal-700' : 'text-red-700'}`}>
                  {row.dailyChange >= 0 ? '+' : ''}{formatCurrency(row.dailyChange)}
                </span>
                <span className={`text-right font-semibold ${row.change >= 0 ? 'text-teal-700' : 'text-red-700'}`}>
                  {row.change >= 0 ? '+' : ''}{formatCurrency(row.change)}
                </span>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-teal-900/10 bg-[#fbfaf7] px-3 py-2 text-sm font-semibold">
              <span>Selected-range stock P/L</span>
              <span className={rangeChange >= 0 ? 'text-teal-700' : 'text-red-700'}>
                {rangeChange >= 0 ? '+' : ''}{formatCurrency(rangeChange)} ({rangeChange >= 0 ? '+' : ''}{rangePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PortfolioPieChart({ holdings, total }) {
  const palette = ['#0f766e', '#14b8a6', '#f59e0b', '#64748b', '#84cc16', '#0ea5e9', '#a855f7', '#ef4444', '#78716c', '#22c55e'];
  let gradientStart = 0;
  const segments = holdings.map((holding, index) => {
    const percent = total > 0 ? (holding.value / total) * 100 : 0;
    const start = gradientStart;
    const end = gradientStart + percent;
    gradientStart = end;
    const segment = {
      holding,
      percent,
      color: palette[index % palette.length],
      start,
      end,
    };
    return segment;
  });
  const gradient = segments.length > 0
    ? `conic-gradient(${segments.map(segment => `${segment.color} ${segment.start}% ${segment.end}%`).join(', ')})`
    : '#e7e5df';

  return (
    <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-1">
      <div className="mx-auto text-center">
        <div
          className="h-44 w-44 rounded-full border border-teal-900/10 shadow-inner"
          style={{ background: gradient }}
          role="img"
          aria-label="Portfolio allocation pie chart"
        />
        <p className="mt-3 text-xs font-medium text-slate-500">Portfolio value</p>
        <p className="text-lg font-semibold text-slate-900">{formatCurrency(total)}</p>
      </div>
      <div className="space-y-2">
        {segments.map(segment => (
          <div key={segment.holding.symbol} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="truncate font-medium text-slate-800">{segment.holding.symbol}</span>
            </span>
            <span className="text-right text-slate-500">{Math.round(segment.percent)}%</span>
            <span className="pl-5 text-xs text-slate-500">{formatCurrency(segment.holding.value)}</span>
            <span className={`text-right text-xs font-semibold ${getDailyValueChange(segment.holding) >= 0 ? 'text-teal-700' : 'text-red-700'}`}>
              {getDailyValueChange(segment.holding) >= 0 ? '+' : ''}{formatCurrency(getDailyValueChange(segment.holding))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskMeter({ label, score, tone, description }) {
  const color = tone === 'high' ? 'bg-red-600' : tone === 'medium' ? 'bg-amber-500' : 'bg-teal-600';

  return (
    <div className="rounded-lg border border-teal-900/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <span className="text-lg font-semibold text-slate-900">{score}/100</span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
    </div>
  );
}

function normalizeGoal(goal) {
  if (goal === 'growth') return 'grow-wealth';
  if (goal === 'income') return 'regular-income';
  if (goal === 'safety') return 'protect-savings';
  if (goalOptions.some(option => option.id === goal)) return goal;
  return 'grow-wealth';
}

function formatSignedPercent(value) {
  if (!Number.isFinite(value)) return 'No live change';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getHoldingPercent(holding, total) {
  return total > 0 ? Math.round((holding.value / total) * 100) : 0;
}

function buildTransparencyModel(summary, target) {
  const total = Math.max(0, Number(summary?.total) || 0);
  const singleStockPercent = Number(summary?.singleStockPercent) || 0;
  const targetSingleStockPercent = Number(target?.['Single stocks']) || 10;
  const currentSingleStockValue = total * (singleStockPercent / 100);
  const targetSingleStockValue = total * (targetSingleStockPercent / 100);
  const excessSingleStockValue = Math.max(0, currentSingleStockValue - targetSingleStockValue);
  const currentCrashLoss = currentSingleStockValue * 0.5;
  const targetCrashLoss = targetSingleStockValue * 0.5;
  const bondAllocation = summary?.allocation?.find(item => item.bucket === 'Bonds')?.percent || 0;
  const targetBondPercent = Number(target?.Bonds) || 30;
  const currentStockDropLoss = total * Math.max(0, 100 - bondAllocation) / 100 * 0.2;
  const targetStockDropLoss = total * Math.max(0, 100 - targetBondPercent) / 100 * 0.2;
  const crashSavings = Math.max(0, currentStockDropLoss - targetStockDropLoss);
  const estimatedGain = Math.round(excessSingleStockValue * 0.28);
  const taxRate = estimatedGain > 0 ? 0.2 : 0;
  const taxes = Math.round(estimatedGain * taxRate);
  const tradingFees = Math.round(Math.max(0, excessSingleStockValue) * 0.003);
  const yearlyFeeRate = 0.01;
  const yearlyFees = Math.round(total * (yearlyFeeRate / 100));
  const recoveryMonths = crashSavings > 0 ? Math.max(1, Math.round(((taxes + tradingFees) / crashSavings) * 12)) : 0;

  return {
    total,
    singleStockPercent,
    targetSingleStockPercent,
    currentSingleStockValue,
    targetSingleStockValue,
    excessSingleStockValue,
    currentCrashLoss,
    targetCrashLoss,
    bondAllocation,
    targetBondPercent,
    currentStockDropLoss,
    targetStockDropLoss,
    crashSavings,
    estimatedGain,
    taxRate,
    taxes,
    tradingFees,
    yearlyFeeRate,
    yearlyFees,
    recoveryMonths,
    singleStockExplanation: {
      plain: `Too many eggs in one basket. If concentrated stocks drop 50%, this portfolio could lose about ${formatCurrency(currentCrashLoss)} from that slice alone.`,
      math: `${singleStockPercent}% of ${formatCurrency(total)} = ${formatCurrency(currentSingleStockValue)} in single stocks. Recommended: keep near ${targetSingleStockPercent}% = ${formatCurrency(targetSingleStockValue)}.`,
      proof: 'In major selloffs, concentrated single-stock investors often fall harder than diversified investors because one bad company headline can dominate the whole portfolio.',
    },
    bondExplanation: {
      plain: 'Bonds act like a shock absorber. When stocks fall, bonds usually move less, so the portfolio drop can feel smaller.',
      math: `With ${bondAllocation}% bonds, a 20% stock drop costs about ${formatCurrency(currentStockDropLoss)}. With ${targetBondPercent}% bonds, the same drop costs about ${formatCurrency(targetStockDropLoss)}.`,
      proof: 'In 2008, balanced portfolios with meaningful bond exposure generally lost much less than all-stock portfolios.',
    },
  };
}

function calculateRangeReturn(holding, history) {
  const currentValue = getCurrentValue(holding);
  const shares = Number(holding?.shares) || 0;
  const points = Array.isArray(history?.points) ? history.points : [];
  const firstClose = points.find(point => Number.isFinite(point.close))?.close;
  const latestPrice = Number.isFinite(history?.price) ? history.price : Number(holding?.currentPrice);
  const endPrice = Number.isFinite(latestPrice) ? latestPrice : 0;
  const startPrice = Number.isFinite(firstClose) ? firstClose : getPreviousPriceFromPercent(endPrice, holding?.livePercentChange);
  const startValue = shares > 0 && startPrice > 0 ? shares * startPrice : currentValue;
  const change = currentValue - startValue;

  return {
    symbol: holding.symbol,
    name: holding.name,
    currentValue,
    startValue,
    change,
    percent: startValue > 0 ? (change / startValue) * 100 : 0,
    dailyChange: getDailyValueChange(holding),
  };
}

function getDailyValueChange(holding) {
  if (holding?.type !== 'Stock') return 0;
  const percentChange = Number(holding?.livePercentChange);
  const currentValue = getCurrentValue(holding);
  if (!Number.isFinite(percentChange) || currentValue <= 0) return 0;
  const previousValue = currentValue / (1 + percentChange / 100);
  return currentValue - previousValue;
}

function getPreviousPriceFromPercent(currentPrice, percentChange) {
  const safeCurrent = Number(currentPrice);
  const safePercent = Number(percentChange);
  if (!Number.isFinite(safeCurrent) || !Number.isFinite(safePercent)) return 0;
  return safeCurrent / (1 + safePercent / 100);
}

function calculateSeedReturn(portfolio) {
  const holdings = Array.isArray(portfolio) ? portfolio : [];
  const seedTotal = holdings.reduce((sum, holding) => sum + getSeedValue(holding), 0);
  const currentTotal = holdings.reduce((sum, holding) => sum + getCurrentValue(holding), 0);
  const change = currentTotal - seedTotal;
  const percent = seedTotal > 0 ? (change / seedTotal) * 100 : 0;
  const drivers = holdings
    .filter(holding => holding.type === 'Stock')
    .map(holding => ({
      symbol: holding.symbol,
      name: holding.name,
      change: getCurrentValue(holding) - getSeedValue(holding),
    }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 4);
  const topDrivers = drivers.filter(driver => driver.change !== 0).slice(0, 2);
  const driverText = topDrivers.length > 0
    ? topDrivers.map(driver => `${driver.symbol} ${driver.change >= 0 ? 'added' : 'reduced'} ${formatCurrency(Math.abs(driver.change))}`).join(', ')
    : 'No stock price movement changed the portfolio yet';
  const summary = `${change >= 0 ? 'Up' : 'Down'} ${formatCurrency(Math.abs(change))} since seed money. ${driverText}.`;

  return {
    seedTotal,
    currentTotal,
    change,
    percent,
    drivers,
    summary,
  };
}

function getSeedValue(holding) {
  if (holding?.type === 'Stock' && Number.isFinite(Number(holding.shares)) && Number.isFinite(Number(holding.fallbackPrice))) {
    return Number(holding.shares) * Number(holding.fallbackPrice);
  }
  return getCurrentValue(holding);
}

function getCurrentValue(holding) {
  const value = Number(holding?.value);
  return Number.isFinite(value) ? value : 0;
}
