import type { Quote } from "../state/types";
import { getMockQuote } from "./mockData";

const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY as string | undefined;
export const isLiveDataEnabled = Boolean(API_KEY);

const HISTORY_LEN = 40;
const liveHistory = new Map<string, number[]>();

interface FinnhubQuoteResponse {
  c: number; // current price
  pc: number; // previous close
  t: number; // timestamp
}

async function fetchFinnhubQuote(symbol: string): Promise<FinnhubQuoteResponse> {
  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${API_KEY}`,
  );
  if (!res.ok) throw new Error(`Finnhub request failed: ${res.status}`);
  return res.json();
}

export async function fetchQuote(symbol: string): Promise<Quote> {
  if (!isLiveDataEnabled) {
    return getMockQuote(symbol);
  }

  try {
    const data = await fetchFinnhubQuote(symbol);
    const history = liveHistory.get(symbol) ?? Array.from({ length: HISTORY_LEN }, () => data.pc);
    const nextHistory = [...history.slice(1), data.c];
    liveHistory.set(symbol, nextHistory);

    return {
      symbol,
      price: data.c,
      prevClose: data.pc,
      changePct: data.pc ? ((data.c - data.pc) / data.pc) * 100 : 0,
      history: nextHistory,
      updatedAt: Date.now(),
    };
  } catch (err) {
    console.warn(`Falling back to simulated data for ${symbol}:`, err);
    return getMockQuote(symbol);
  }
}
