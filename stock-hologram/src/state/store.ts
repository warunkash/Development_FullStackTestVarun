import { create } from "zustand";
import type { ChatMessage, Quote } from "./types";

interface AppState {
  watchlist: string[];
  quotes: Record<string, Quote>;
  selected: string | null;
  messages: ChatMessage[];

  addSymbol: (symbol: string) => void;
  removeSymbol: (symbol: string) => void;
  select: (symbol: string | null) => void;
  setQuote: (quote: Quote) => void;
  pushMessage: (message: Omit<ChatMessage, "id">) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  watchlist: ["AAPL", "MSFT", "TSLA", "NVDA", "GOOGL"],
  quotes: {},
  selected: "AAPL",
  messages: [
    {
      id: "init",
      from: "jarvis",
      text: "Good to see you. Markets are online. Ask me about any ticker on the board.",
    },
  ],

  addSymbol: (symbol) => {
    const sym = symbol.toUpperCase().trim();
    if (!sym || get().watchlist.includes(sym)) return;
    set((s) => ({ watchlist: [...s.watchlist, sym] }));
  },

  removeSymbol: (symbol) => {
    set((s) => ({
      watchlist: s.watchlist.filter((sym) => sym !== symbol),
      selected: s.selected === symbol ? s.watchlist.find((sym) => sym !== symbol) ?? null : s.selected,
    }));
  },

  select: (symbol) => set({ selected: symbol }),

  setQuote: (quote) =>
    set((s) => ({ quotes: { ...s.quotes, [quote.symbol]: quote } })),

  pushMessage: (message) =>
    set((s) => ({
      messages: [...s.messages, { ...message, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }],
    })),
}));
