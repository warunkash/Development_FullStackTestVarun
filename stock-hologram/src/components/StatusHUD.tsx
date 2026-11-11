import { useEffect, useState } from "react";
import { isLiveDataEnabled } from "../api/finnhub";
import { useAppStore } from "../state/store";

export function StatusHUD() {
  const [now, setNow] = useState(new Date());
  const watchlist = useAppStore((s) => s.watchlist);
  const quotes = useAppStore((s) => s.quotes);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const values = watchlist.map((sym) => quotes[sym]?.changePct ?? 0);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  return (
    <div className="status-hud hud-panel">
      <div className="status-title">STARK INDUSTRIES // MARKET HOLOGRAM</div>
      <div className="status-row">
        <span className={`status-badge ${isLiveDataEnabled ? "live" : "sim"}`}>
          {isLiveDataEnabled ? "● LIVE DATA" : "◌ SIMULATED DATA"}
        </span>
        <span className="status-clock">{now.toLocaleTimeString()}</span>
      </div>
      <div className="status-row">
        <span className={`status-pulse ${avg >= 0 ? "up" : "down"}`}>
          MARKET PULSE {avg >= 0 ? "+" : ""}
          {avg.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}
