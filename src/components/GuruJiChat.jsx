import { useEffect, useState } from 'react';
import { useLiveSamplePortfolio } from '../hooks/useLiveSamplePortfolio';
import { buildRecommendation } from '../solvers/rebalanceSolver';

const GuruJiChat = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: 'I am Guru-Ji, your portfolio guide. Ask me about live prices, risk, or scenarios.',
    },
  ]);
  const [chatBusy, setChatBusy] = useState(false);
  const [goal] = useState('growth');
  const [comfort] = useState('medium');
  const [cashNeed] = useState(8000);
  const [scenarioId] = useState('market-drop');
  const [gurujiContext, setGurujiContext] = useState(null);
  const [contextError, setContextError] = useState('');
  const { portfolio } = useLiveSamplePortfolio();

  useEffect(() => {
    let isMounted = true;

    async function loadGurujiContext() {
      try {
        const response = await fetch('/api/guruji-context');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load Guru-Ji context.');
        if (isMounted) {
          setGurujiContext(data);
          setContextError('');
        }
      } catch (error) {
        if (isMounted) setContextError(error.message);
      }
    }

    loadGurujiContext();

    return () => {
      isMounted = false;
    };
  }, []);

  const recommendation = buildRecommendation({
    holdings: portfolio,
    goal,
    comfort,
    cashNeed,
    scenarioId,
  });
  const { summary } = recommendation;

  useEffect(() => {
    // Auto appear after 2 seconds
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isVisible && !isExpanded) {
      // Auto-scroll into view (though fixed position, this ensures visibility)
      const element = document.getElementById('guruji-chat');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  }, [isVisible, isExpanded]);

  const handleChatSubmit = async (event) => {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || chatBusy) return;

    const nextMessages = [...chatMessages, { role: 'user', content: message }];
    setChatMessages([...nextMessages, { role: 'assistant', content: 'Thinking...' }]);
    setChatInput('');
    setChatBusy(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: nextMessages,
          portfolio: {
            holdings: portfolio,
            summary,
            goal,
            comfort,
            cashNeed,
            scenario: recommendation.scenario,
            recommendation: {
              title: recommendation.title,
              steps: recommendation.steps,
              explanations: recommendation.explanations,
              costNote: recommendation.costNote,
            },
          },
          context: gurujiContext,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Guru-Ji could not respond.');
      setChatMessages([...nextMessages, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      setChatMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: error.message,
        },
      ]);
    } finally {
      setChatBusy(false);
    }
  };

  const parseButtonsFromMessage = (content) => {
    const buttonMatch = content.match(/Buttons:\s*\[([^\]]+)\]/);
    if (buttonMatch) {
      const buttons = buttonMatch[1].split(',').map(btn => btn.trim().replace(/"/g, ''));
      const cleanContent = content.replace(/Buttons:\s*\[([^\]]+)\]/, '').trim();
      return { content: cleanContent, buttons };
    }
    return { content, buttons: [] };
  };

  const handleButtonClick = (buttonText) => {
    setChatInput(buttonText);
    // Auto-submit after a brief delay
    setTimeout(() => {
      const form = document.getElementById('guruji-chat-form');
      if (form) form.requestSubmit();
    }, 100);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (!isVisible) return null;

  return (
    <div
      id="guruji-chat"
      className={`fixed bottom-5 right-5 z-50 transition-all duration-500 ${
        isExpanded ? 'w-80 h-96' : 'w-auto h-auto'
      } ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
    >
      {!isExpanded ? (
        <div
          className="cursor-pointer rounded-full border border-teal-900/20 bg-white px-4 py-2 shadow-lg shadow-teal-950/10 transition-colors hover:bg-amber-50"
          onClick={toggleExpanded}
          title="Guru-Ji is here to explain your portfolio"
        >
          <span className="font-bold text-teal-800">Guru-Ji</span>
        </div>
      ) : (
        <div className="flex h-full flex-col rounded-lg border border-teal-900/10 bg-[#fbfaf7] shadow-xl shadow-teal-950/10">
          <div className="flex items-center justify-between rounded-t-lg bg-teal-900 p-3 text-white">
            <div className="flex items-center">
              <span className="font-bold">Guru-Ji</span>
            </div>
            <button
              onClick={toggleExpanded}
              className="text-xl text-white hover:text-amber-100"
            >
              x
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {chatMessages.slice(-5).map((msg, index) => {
              const { content, buttons } = parseButtonsFromMessage(msg.content);
              return (
                <div key={index} className="mb-3">
                  <div className={`rounded-lg p-3 text-sm leading-relaxed text-slate-900 ${
                    msg.role === 'user' ? 'ml-8 bg-teal-900 text-white' : 'border border-teal-900/10 bg-white'
                  }`}>
                    {content}
                  </div>
                  {buttons.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {buttons.map((btn, btnIndex) => (
                        <button
                          key={btnIndex}
                          onClick={() => handleButtonClick(btn)}
                          className="rounded-full border border-teal-900/20 bg-white px-3 py-1 text-sm text-teal-800 transition hover:bg-teal-900 hover:text-white"
                        >
                          {btn}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <form id="guruji-chat-form" onSubmit={handleChatSubmit} className="border-t border-teal-900/10 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !chatBusy) {
                    handleChatSubmit(e);
                  }
                }}
                placeholder="Ask Guru-Ji..."
                className="flex-1 rounded-lg border border-teal-900/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                disabled={chatBusy}
              />
              <button
                type="submit"
                disabled={chatBusy || !chatInput.trim()}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {chatBusy ? '...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default GuruJiChat;
