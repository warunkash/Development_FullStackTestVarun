import type { Quote } from "../state/types";

const SEED_PRICES: Record<string, number> = {
  AAPL: 227.5,
  MSFT: 421.3,
  TSLA: 248.1,
  NVDA: 128.9,
  GOOGL: 178.4,
  AMZN: 186.2,
};

const seeds = new Map<string, number>(Object.entries(SEED_PRICES));

function seedFor(symbol: string): number {
  if (!seeds.has(symbol)) {
    // deterministic-ish pseudo price for unknown tickers
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) % 1000;
    seeds.set(symbol, 20 + hash / 4);
  }
  return seeds.get(symbol)!;
}

const HISTORY_LEN = 40;
const state = new Map<string, Quote>();

export function getMockQuote(symbol: string): Quote {
  const existing = state.get(symbol);
  if (existing) return tick(existing);

  const base = seedFor(symbol);
  const history = Array.from({ length: HISTORY_LEN }, () => base * (1 + (Math.random() - 0.5) * 0.01));
  const quote: Quote = {
    symbol,
    price: history[history.length - 1],
    prevClose: base,
    changePct: 0,
    history,
    updatedAt: Date.now(),
  };
  state.set(symbol, quote);
  return quote;
}

function tick(prev: Quote): Quote {
  const drift = (Math.random() - 0.5) * prev.price * 0.006;
  const price = Math.max(0.5, prev.price + drift);
  const history = [...prev.history.slice(1), price];
  const quote: Quote = {
    symbol: prev.symbol,
    price,
    prevClose: prev.prevClose,
    changePct: ((price - prev.prevClose) / prev.prevClose) * 100,
    history,
    updatedAt: Date.now(),
  };
  state.set(prev.symbol, quote);
  return quote;
}
