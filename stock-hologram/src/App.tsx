import { HologramScene } from "./scene/HologramScene";
import { StatusHUD } from "./components/StatusHUD";
import { WatchlistBar } from "./components/WatchlistBar";
import { JarvisPanel } from "./jarvis/JarvisPanel";
import { useQuotes } from "./hooks/useQuotes";

export default function App() {
  useQuotes();

  return (
    <div className="app-root">
      <HologramScene />
      <div className="hud-overlay">
        <StatusHUD />
        <WatchlistBar />
        <JarvisPanel />
        <div className="corner corner-tl" />
        <div className="corner corner-tr" />
        <div className="corner corner-bl" />
        <div className="corner corner-br" />
      </div>
      <div className="scanlines" />
    </div>
  );
}
