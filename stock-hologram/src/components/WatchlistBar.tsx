import { useState } from "react";
import { useAppStore } from "../state/store";

export function WatchlistBar() {
  const [draft, setDraft] = useState("");
  const watchlist = useAppStore((s) => s.watchlist);
  const quotes = useAppStore((s) => s.quotes);
  const selected = useAppStore((s) => s.selected);
  const select = useAppStore((s) => s.select);
  const addSymbol = useAppStore((s) => s.addSymbol);
  const removeSymbol = useAppStore((s) => s.removeSymbol);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    addSymbol(draft);
    setDraft("");
  }

  return (
    <div className="watchlist-bar hud-panel">
      <div className="watchlist-chips">
        {watchlist.map((symbol) => {
          const q = quotes[symbol];
          const up = (q?.changePct ?? 0) >= 0;
          return (
            <button
              key={symbol}
              className={`watchlist-chip ${symbol === selected ? "active" : ""} ${up ? "up" : "down"}`}
              onClick={() => select(symbol)}
            >
              <span>{symbol}</span>
              <span className="chip-pct">{q ? `${up ? "+" : ""}${q.changePct.toFixed(1)}%` : "..."}</span>
              <span
                className="chip-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSymbol(symbol);
                }}
              >
                ×
              </span>
            </button>
          );
        })}
      </div>
      <form onSubmit={handleAdd} className="watchlist-add">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="+ ticker"
          maxLength={5}
        />
      </form>
    </div>
  );
}
