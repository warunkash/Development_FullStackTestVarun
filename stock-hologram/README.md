# Stock Market Hologram

An Iron Man / J.A.R.V.I.S.–style holographic HUD for visualizing the stock
market — a rotating wireframe core, floating translucent stock panels with
live sparkline charts on a Tron-style grid, and a conversational assistant
you can type (or talk) to.

Built with React + TypeScript + [react-three-fiber](https://docs.pmnd.rs/react-three-fiber) (Three.js) + Zustand.

## Running it

```bash
npm install
npm run dev
```

Then open the printed local URL (defaults to http://localhost:5173).

## Live vs. simulated data

By default the app runs entirely on simulated (random-walk) price ticks —
no API key required, works offline.

To pull real quotes from [Finnhub](https://finnhub.io):

1. Get a free API key at https://finnhub.io/register
2. Copy `.env.example` to `.env` and set `VITE_FINNHUB_API_KEY`
3. Restart the dev server

When the key is present the app polls Finnhub's `/quote` endpoint every 15s
per watchlisted ticker; if a request fails it falls back to simulated data
for that tick.

## Talking to J.A.R.V.I.S.

Type into the panel in the bottom-left corner (or click the mic icon to use
your browser's speech recognition, where supported). Example commands:

- `show TSLA` — bring a ticker to focus (adds it if not already tracked)
- `add NVDA` / `remove NVDA` — manage the watchlist
- `compare AAPL and MSFT`
- `price of AAPL` / `how is AAPL doing`
- `market status`, `top gainer`, `biggest loser`
- `help`

Replies are read aloud via the Web Speech API when supported (toggle with
the 🔊 button in the JARVIS panel header).

## Project layout

```
src/
  api/         Finnhub integration + mock data generator
  state/       Zustand store (watchlist, quotes, chat log)
  hooks/       Polling hook that keeps quotes fresh
  scene/       The 3D hologram (grid floor, core, panels, charts, particles)
  jarvis/      Command parser, chat panel, speech I/O
  components/  2D HUD overlays (status bar, watchlist chips)
```
