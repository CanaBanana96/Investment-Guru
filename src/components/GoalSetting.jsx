import { useState, useEffect } from 'react';

export default function GoalSetting({ onGoalSelect }) {
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [selectedRisk, setSelectedRisk] = useState('medium');

  const goals = [
    {
      id: 'buy-home',
      emoji: '🏠',
      title: 'Buy a home',
      subtitle: 'Save for down payment',
    },
    {
      id: 'education',
      emoji: '📚',
      title: "Child's education",
      subtitle: 'Build education corpus',
    },
    {
      id: 'retire-early',
      emoji: '🌴',
      title: 'Retire early',
      subtitle: 'Build long-term wealth',
    },
    {
      id: 'grow-wealth',
      emoji: '📈',
      title: 'Grow wealth',
      subtitle: 'Beat inflation & grow',
    },
    {
      id: 'protect-savings',
      emoji: '🛡️',
      title: 'Protect savings',
      subtitle: 'Low risk, steady returns',
    },
    {
      id: 'regular-income',
      emoji: '💵',
      title: 'Regular income',
      subtitle: 'Dividends & cashflow',
    },
  ];

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('userGoalSettings');
    if (saved) {
      const { goal, risk } = JSON.parse(saved);
      setSelectedGoal(goal);
      setSelectedRisk(risk);
    }
  }, []);

  const handleConfirm = () => {
    if (!selectedGoal) {
      alert('Please select a goal to continue');
      return;
    }

    const settings = {
      goal: selectedGoal,
      risk: selectedRisk,
    };

    localStorage.setItem('userGoalSettings', JSON.stringify(settings));
    onGoalSelect(selectedGoal, selectedRisk);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            INVESTMENT GURU
          </p>
          <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">
            What is your main goal?
          </h1>
          <p className="mt-3 text-base text-slate-600">
            We build your entire plan around what matters most to you. No finance degree needed.
          </p>
        </div>
      </div>

      {/* Goal Cards */}
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <div
              key={goal.id}
              onClick={() => setSelectedGoal(goal.id)}
              className={`group relative cursor-pointer rounded-xl border-2 p-6 transition-all duration-300 ${
                selectedGoal === goal.id
                  ? 'border-green-500 bg-green-50 shadow-lg'
                  : 'border-slate-200 bg-white shadow-md hover:shadow-xl hover:scale-105'
              }`}
            >
              {/* Checkmark for selected */}
              {selectedGoal === goal.id && (
                <div className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white shadow-md">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}

              {/* Radio Button */}
              <div className="mb-4 flex items-start justify-between">
                <div className="text-4xl">{goal.emoji}</div>
                <div
                  className={`mt-1 h-5 w-5 rounded-full border-2 transition-all ${
                    selectedGoal === goal.id
                      ? 'border-green-500 bg-green-500'
                      : 'border-slate-300 group-hover:border-slate-400'
                  }`}
                />
              </div>

              {/* Title and Subtitle */}
              <h3 className="text-lg font-bold text-slate-900">{goal.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{goal.subtitle}</p>
            </div>
          ))}
        </div>

        {/* Risk Appetite Selector */}
        <div className="mt-12">
          <h2 className="mb-4 text-2xl font-bold text-slate-900">What's your risk appetite?</h2>
          <p className="mb-6 text-slate-600">
            This helps us balance growth potential with stability
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:gap-4">
            {[
              { id: 'low', label: 'Low', description: 'Conservative, steady returns' },
              { id: 'medium', label: 'Medium', description: 'Balanced approach (Recommended)' },
              { id: 'high', label: 'High', description: 'Aggressive, high growth' },
            ].map((risk) => (
              <button
                key={risk.id}
                onClick={() => setSelectedRisk(risk.id)}
                className={`flex-1 rounded-lg border-2 px-4 py-4 text-center transition-all duration-200 ${
                  selectedRisk === risk.id
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-slate-200 bg-white shadow-sm hover:border-slate-300'
                }`}
              >
                <div className="font-semibold text-slate-900">{risk.label}</div>
                <div className="mt-1 text-xs text-slate-600">{risk.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Confirm Button */}
        <div className="mt-12 flex justify-center">
          <button
            onClick={handleConfirm}
            disabled={!selectedGoal}
            className={`rounded-lg px-8 py-4 text-lg font-semibold transition-all duration-200 ${
              selectedGoal
                ? 'bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:shadow-xl active:scale-95'
                : 'cursor-not-allowed bg-slate-300 text-slate-500'
            }`}
          >
            Continue to Dashboard
          </button>
        </div>

        {/* Info Section */}
        <div className="mt-16 rounded-lg bg-blue-50 p-6 text-center">
          <p className="text-sm text-slate-700">
            💡 You can update these settings anytime from the dashboard settings
          </p>
        </div>
      </div>
    </div>
  );
}
