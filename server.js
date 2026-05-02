import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import YahooFinance from "yahoo-finance2";
import { samplePortfolio } from "./src/data/samplePortfolio.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 5173);
const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const tickerPattern = /^[A-Z0-9.^-]{1,16}$/;

loadLocalEnv();

const vite = isProduction
  ? null
  : await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "POST" && url.pathname === "/api/chat") {
      await handleChat(req, res);
      return;
    }

    const stockHistoryMatch = url.pathname.match(/^\/api\/stock\/([^/]+)\/history$/);
    if (req.method === "GET" && stockHistoryMatch) {
      await handleStockHistory(stockHistoryMatch[1], url.searchParams.get("range"), res);
      return;
    }

    const stockMatch = url.pathname.match(/^\/api\/stock\/([^/]+)$/);
    if (req.method === "GET" && stockMatch) {
      await handleStockQuote(stockMatch[1], res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/stocks") {
      await handleMultipleStockQuotes(url.searchParams.get('tickers'), res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/guruji-context") {
      await handleGurujiContext(res);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    if (vite) {
      await serveVite(req, res);
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    vite?.ssrFixStacktrace(error);
    sendJson(res, 500, { error: error.message || "Unexpected server error." });
  }
});

server.listen(port, () => {
  console.log(`INVESTMENT GURU running at http://localhost:${port}`);
});

async function handleChat(req, res) {
  loadLocalEnv();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: "OPENROUTER_API_KEY is not configured on the server." });
    return;
  }

  const body = await readJson(req);
  const message = String(body.message || "").trim();
  if (!message) {
    sendJson(res, 400, { error: "Message is required." });
    return;
  }

  const response = await fetch(openRouterUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5173",
      "X-Title": "INVESTMENT GURU Everyday Investor Challenge",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 550,
      messages: [
        {
          role: "system",
          content:
            "You are Guru-Ji, a warm, wise portfolio advisor for a fintech app. Your user is \"beta\" and is a total beginner. Explain everything like you would to a smart 12-year-old: simple words, short sentences, and one clear idea at a time. Talk about the whole portfolio, not only the plan: holdings, live prices, market moves, concentration, allocation, risk, and next actions. Use the live market context provided by the app, but do not invent news or prices that are not in the context. Speak in 1-2 short sentences maximum. Avoid finance jargon. If you must use a term, explain it immediately in plain words. Never ask \"How can I help?\" - proactively guide.\n\nEvery response MUST end with exactly 2 buttons from this list:\n[\"Show me\", \"Later\", \"Fix it\", \"Explain simply\", \"Got it\", \"What does that mean?\", \"Take me there\", \"Not now\"]\n\nYour rules:\n1. Reference actual numbers when available: portfolio value, health score, single-stock %, live price moves, top movers, or stock P/L\n2. If single stocks >20% then warn about crash cost in dollars using plain language\n3. If health score <65 then offer one practical next move\n4. Connect market movement to the user's holdings with simple cause/effect words like \"this means\" and \"because\"\n5. After any recommendation, offer \"Explain simply\" button\n6. Never send more than 2 sentences\n7. Do not use terms like allocation, volatility, rebalance, diversification, equity, bond ladder, or tax efficiency unless you define them in the same sentence\n\nExample good responses:\n\"Beta, AAPL is up today, but 42% in single stocks means too much money depends on a few companies. Want to make that safer?\" Buttons: [Fix it] [Explain simply]\n\n\"Health score 58 means the portfolio is a bit risky. One small change can spread the money out so one bad stock hurts less.\" Buttons: [Show me] [What does that mean?]\n\nExample bad responses (NEVER):\n\"How can I help you today?\"\n\"Based on my comprehensive analysis...\"\n\"Your allocation has high volatility and needs rebalancing.\"\nAnything with bullet points or numbered lists",
        },
        {
          role: "system",
          content: `Current app context:\n${JSON.stringify(body.portfolio || {}, null, 2)}`,
        },
        ...normalizeHistory(body.history),
        { role: "user", content: message },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    sendJson(res, response.status, {
      error: data.error?.message || "The LLM request failed.",
    });
    return;
  }

  sendJson(res, 200, {
    reply: data.choices?.[0]?.message?.content || "I could not generate a response.",
  });
}

async function handleStockQuote(rawTicker, res) {
  const ticker = decodeURIComponent(rawTicker).trim().toUpperCase();
  if (!tickerPattern.test(ticker)) {
    sendJson(res, 400, { error: "Invalid ticker." });
    return;
  }

  const quote = await yahooFinance.quote(ticker);
  sendJson(res, 200, {
    ticker,
    price: quote.regularMarketPrice,
    change: quote.regularMarketChange,
    percent_change: quote.regularMarketChangePercent,
  });
}

async function handleStockHistory(rawTicker, rawRange, res) {
  const ticker = decodeURIComponent(rawTicker).trim().toUpperCase();
  if (!tickerPattern.test(ticker)) {
    sendJson(res, 400, { error: "Invalid ticker." });
    return;
  }

  const rangeDays = {
    "1d": 1,
    "3d": 3,
    "7d": 7,
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "1y": 365,
  };
  const range = rangeDays[rawRange] ? rawRange : "1m";
  const period1 = new Date(Date.now() - rangeDays[range] * 24 * 60 * 60 * 1000);

  const chart = await yahooFinance.chart(ticker, {
    period1,
    interval: "1d",
  });

  const points = (chart.quotes || [])
    .filter((quote) => quote.close != null)
    .map((quote) => ({
      date: quote.date,
      close: quote.close,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      volume: quote.volume,
    }));

  const first = points[0]?.close ?? chart.meta?.regularMarketPrice ?? null;
  const last = points.at(-1)?.close ?? chart.meta?.regularMarketPrice ?? null;
  const change = first != null && last != null ? last - first : null;
  const percentChange = first && change != null ? (change / first) * 100 : null;

  sendJson(res, 200, {
    ticker,
    range,
    currency: chart.meta?.currency || "USD",
    price: last,
    change,
    percent_change: percentChange,
    points,
  });
}

async function handleMultipleStockQuotes(tickersParam, res) {
  if (!tickersParam) {
    sendJson(res, 400, { error: "Tickers parameter is required." });
    return;
  }

  const tickers = tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(t => tickerPattern.test(t));

  if (tickers.length === 0 || tickers.length > 50) {
    sendJson(res, 400, { error: "Invalid tickers list. Must provide 1-50 valid tickers." });
    return;
  }

  try {
    const quotePromises = tickers.map(async (ticker) => {
      try {
        const quote = await yahooFinance.quote(ticker);
        return {
          ticker,
          price: quote.regularMarketPrice,
          change: quote.regularMarketChange,
          percent_change: quote.regularMarketChangePercent,
        };
      } catch (error) {
        return {
          ticker,
          error: "Unable to fetch quote",
        };
      }
    });

    const results = await Promise.all(quotePromises);
    sendJson(res, 200, results);
  } catch (error) {
    sendJson(res, 500, { error: "Failed to fetch stock quotes." });
  }
}

async function handleGurujiContext(res) {
  const portfolio = await buildPortfolioContext(samplePortfolio);
  const marketData = await buildMarketData();

  sendJson(res, 200, {
    portfolio,
    marketData,
    timestamp: new Date().toISOString(),
  });
}

async function buildPortfolioContext(portfolioData) {
  const holdings = await Promise.all(
    portfolioData.map(async (holding) => {
      if (holding.type !== 'Stock') {
        return {
          ...holding,
          currentPrice: null,
          currentValue: Number(holding.value) || 0,
          liveChange: null,
          livePercentChange: null,
          isLive: false,
        };
      }

      const quote = await safeQuote(holding.symbol);
      const currentPrice = quote?.regularMarketPrice ?? holding.fallbackPrice ?? getFallbackPrice(holding);
      const shares = Number(holding.shares || 0);
      const currentValue = Math.round(shares * Number(currentPrice));

      return {
        ...holding,
        currentPrice,
        currentValue,
        liveChange: quote?.regularMarketChange ?? null,
        livePercentChange: quote?.regularMarketChangePercent ?? null,
        isLive: Boolean(quote && typeof quote.regularMarketPrice === 'number'),
      };
    })
  );

  return {
    holdings,
    summary: summarizePortfolio(holdings),
  };
}

async function buildMarketData() {
  const [vixQuote, spyQuote] = await Promise.all([
    safeQuote('^VIX'),
    safeQuote('SPY'),
  ]);

  const vix = Number(vixQuote?.regularMarketPrice ?? null);
  const spyChange = Number(spyQuote?.regularMarketChangePercent ?? null);
  const marketTrend = getMarketTrend(vix, spyChange);

  return {
    vix: Number.isFinite(vix) ? vix : null,
    sp500: Number.isFinite(spyChange) ? `${spyChange >= 0 ? '+' : ''}${spyChange.toFixed(2)}%` : null,
    marketTrend,
    fearLevel: getFearLevel(vix),
    notes: buildMarketNotes(vix, spyChange),
    source: 'live',
  };
}

async function safeQuote(ticker) {
  try {
    return await yahooFinance.quote(ticker);
  } catch {
    return null;
  }
}

function summarizePortfolio(holdings) {
  const totalValue = holdings.reduce((sum, holding) => sum + Number(holding.currentValue ?? holding.value ?? 0), 0);
  const stockValue = holdings
    .filter((holding) => holding.type === 'Stock')
    .reduce((sum, holding) => sum + Number(holding.currentValue ?? 0), 0);
  const singleStockValue = holdings
    .filter((holding) => holding.bucket?.toLowerCase().includes('single'))
    .reduce((sum, holding) => sum + Number(holding.currentValue ?? 0), 0);

  return {
    totalValue,
    stockValue,
    singleStockValue,
    stockPct: totalValue ? Number(((stockValue / totalValue) * 100).toFixed(1)) : 0,
    singleStockPct: totalValue ? Number(((singleStockValue / totalValue) * 100).toFixed(1)) : 0,
  };
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

function getFallbackPrice(holding) {
  const shares = Number(holding.shares);
  const value = Number(holding.value);
  return shares > 0 && value > 0 ? value / shares : 0;
}

async function serveStatic(pathname, res) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const staticRoot = join(root, "dist");
  let filePath = normalize(join(staticRoot, cleanPath));

  if (!filePath.startsWith(staticRoot)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  if (!existsSync(filePath)) {
    filePath = join(staticRoot, "index.html");
  }

  const content = await readFile(filePath);
  res.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
  });
  res.end(content);
}

function serveVite(req, res) {
  return new Promise((resolve, reject) => {
    vite.middlewares(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function normalizeHistory(history = []) {
  return history
    .filter((message) => message && ["user", "assistant"].includes(message.role))
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: String(message.content || "").slice(0, 2000),
    }));
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function loadLocalEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (!process.env[key]) process.env[key] = value.trim().replace(/^["']|["']$/g, "");
  }
}
