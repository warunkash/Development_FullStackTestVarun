import { useEffect } from "react";
import { fetchQuote, isLiveDataEnabled } from "../api/finnhub";
import { useAppStore } from "../state/store";

const POLL_INTERVAL_MS = isLiveDataEnabled ? 15_000 : 1_500;

export function useQuotes() {
  const watchlist = useAppStore((s) => s.watchlist);
  const setQuote = useAppStore((s) => s.setQuote);

  useEffect(() => {
    let cancelled = false;

    async function pollAll() {
      const results = await Promise.all(watchlist.map((symbol) => fetchQuote(symbol)));
      if (cancelled) return;
      results.forEach(setQuote);
    }

    pollAll();
    const id = setInterval(pollAll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [watchlist, setQuote]);
}
