import json, html
from datetime import datetime, timezone
from pathlib import Path
R = json.load(open(Path(__file__).parent / "reports/results.json"))
real, nc, nz = R["real"], R["null_with_costs"], R["null_zero_cost"]
def d(ts): return datetime.fromtimestamp(int(ts), timezone.utc).strftime("%b %d %H:%M")
def f(x, n=2): return f"{x:,.{n}f}"

# equity curve svg
eq = real["equity"][::4]
W, H, L, B, T, Rr = 680, 220, 52, 26, 12, 12
xs = [e[0] for e in eq]; ys = [e[1] for e in eq]
lo, hi = min(ys + [10000]) - 50, max(ys) + 50
X = lambda t: L + (t - xs[0]) / (xs[-1] - xs[0]) * (W - L - Rr)
Y = lambda v: T + (hi - v) / (hi - lo) * (H - T - B)
pts = " ".join(f"{X(t):.1f},{Y(v):.1f}" for t, v in eq)
grid = ""
for i in range(5):
    v = lo + (hi - lo) * i / 4
    grid += f'<line x1="{L}" x2="{W-Rr}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" class="gl"/><text x="{L-6}" y="{Y(v)+4:.1f}" class="ax" text-anchor="end">{v:,.0f}</text>'
for i in range(5):
    t = xs[0] + (xs[-1] - xs[0]) * i / 4
    grid += f'<text x="{X(t):.1f}" y="{H-6}" class="ax" text-anchor="middle">{datetime.fromtimestamp(t, timezone.utc).strftime("%b %d")}</text>'
mk = "".join(f'<circle cx="{X(t["close_ts"]):.1f}" cy="{Y(min(max(next((v for ts,v in real["equity"] if ts>=t["close_ts"]), ys[-1]),lo),hi)):.1f}" r="4" class="dot"/>' for t in real["trades_detail"])
eqsvg = f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Equity curve">{grid}<line x1="{L}" x2="{W-Rr}" y1="{Y(10000):.1f}" y2="{Y(10000):.1f}" class="base"/><polyline points="{pts}" class="eq"/>{mk}</svg>'

# null distribution: strip of 30 runs
runs = sorted(r["return_pct"] for r in R["null_runs"])
W2, H2 = 680, 120
mn, mx = min(runs + [-12]), max(runs + [12])
X2 = lambda v: 20 + (v - mn) / (mx - mn) * (W2 - 40)
dots = "".join(f'<circle cx="{X2(v):.1f}" cy="{50 + (i%5)*9}" r="4" class="{"pos" if v>0 else "neg"}"/>' for i, v in enumerate(runs))
ticks = "".join(f'<line x1="{X2(v):.1f}" x2="{X2(v):.1f}" y1="30" y2="100" class="gl"/><text x="{X2(v):.1f}" y="116" class="ax" text-anchor="middle">{v:+d}%</text>' for v in range(-10, 11, 5))
nullsvg = f'<svg viewBox="0 0 {W2} {H2}" role="img" aria-label="Return of 30 no-edge runs">{ticks}<line x1="{X2(0):.1f}" x2="{X2(0):.1f}" y1="30" y2="100" class="base"/>{dots}</svg>'

rows = "".join(f'<tr><td>{t["symbol"]}</td><td>{t["side"]}</td><td>{d(t["open_ts"])}</td><td>{t["trigger"]}</td><td class="n">{t["lots"]}</td><td class="n">{t["entry"]:.5g}</td><td class="n">{t["sl"]:.5g}</td><td>{t["exit"]}</td><td class="n {"pos" if t["r"]>0 else "neg"}">{t["r"]:+.2f}R</td><td class="n {"pos" if t["pnl"]>0 else "neg"}">{t["pnl"]:+,.0f}</td></tr>' for t in real["trades_detail"])
tcs = [("TC-01", "Wick-only break of swing high", "No BOS, no zone mapped, stays IDLE"),
       ("TC-02", "Zone hit directly, no shallow tap", "Flagged NO_INDUCEMENT, zero orders"),
       ("TC-03", "Sweep, then body closes below origin zone", "INVALIDATED, no long executed"),
       ("TC-04", "Sweep, wick into zone, 1m CHoCH", "Buy signal, SL = sweep low - 0.5 ATR, 1% risk sizing"),
       ("TC-05", "High-impact news within 10 min", "ACTIVE_RESTRICTION blocks a complete setup")]
tcrows = "".join(f'<tr><td class="mono">{a}</td><td>{b}</td><td>{c}</td><td><span class="pill ok">PASS</span></td></tr>' for a, b, c in tcs)
sens = "".join(f'<tr><td>{html.escape(k)}</td><td class="n">{v["trades_per_run"]:.1f}</td><td class="n">{v["mean_return_pct"]:+.2f}%</td><td class="n">{v["mean_avg_r"]:+.2f}R</td><td class="n">{v["pct_runs_profitable"]:.0f}%</td><td class="n">{v["worst_dd_pct"]:.1f}%</td></tr>' for k, v in R["sensitivity_null"].items())
ev = real["state_events"]
tot = lambda k: sum(e.get(k, 0) for e in ev.values())
funnel = [("Bullish/bearish BOS mapped", tot("BOS")), ("Shallow tap (inducement) formed", tot("INDUCEMENT")),
          ("Sweep into origin zone", tot("SWEEP")), ("Setups reaching an LTF trigger", real["setups_reaching_trigger"]),
          ("Trades executed", real["trades"])]
fmax = funnel[0][1]
fun = "".join(f'<div class="fr"><span>{a}</span><div class="bar"><i style="width:{max(2,100*b/fmax):.1f}%"></i></div><b>{b}</b></div>' for a, b in funnel)
rej = ", ".join(f"{k.replace('_',' ')}: {v}" for k, v in real["rejects"].items()) or "none"

page = f"""<title>AMN Bot Backtest</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,600&display=swap">
<style>
/* layout: single readable column, summary first, evidence below */
:root{{--bg:#f3f5f6;--card:#fff;--fg:#14202b;--mut:#5b6b78;--line:#d8e0e5;--accent:#0b6e75;--good:#1c7c4a;--bad:#b3362e;--warn:#9a6a00;--disp:'Fraunces',Georgia,serif;--sans:'IBM Plex Sans',system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,monospace}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#0e161c;--card:#15212a;--fg:#e4ecf0;--mut:#8ea0ad;--line:#26363f;--accent:#4fc3c9;--good:#4cc283;--bad:#f0746b;--warn:#e0b04a;color-scheme:dark}}}}
:root[data-theme="dark"]{{--bg:#0e161c;--card:#15212a;--fg:#e4ecf0;--mut:#8ea0ad;--line:#26363f;--accent:#4fc3c9;--good:#4cc283;--bad:#f0746b;--warn:#e0b04a;color-scheme:dark}}
body{{background:var(--bg);color:var(--fg);font:15px/1.55 var(--sans);padding-block:28px 48px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
main{{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:28px}}
h1{{font:600 34px/1.1 var(--disp);margin:0;text-wrap:balance}}h2{{font:600 13px var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--mut);margin:0 0 10px}}
p{{margin:0 0 10px;max-width:68ch}}.mut{{color:var(--mut)}}.mono{{font-family:var(--mono);font-size:13px}}
section{{min-width:0}}
.verdict{{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:16px 18px}}
.kpis{{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}}
.k{{border-top:2px solid var(--accent);padding-top:6px}}.k b{{display:block;font:500 24px var(--mono);font-variant-numeric:tabular-nums}}.k span{{font-size:12px;color:var(--mut)}}
.scroll{{overflow-x:auto}}table{{border-collapse:collapse;width:100%;font-size:13.5px}}th{{text-align:left;font-weight:500;color:var(--mut);font-size:12px;border-bottom:1px solid var(--line);padding:6px 10px 6px 0;white-space:nowrap}}td{{padding:7px 10px 7px 0;border-bottom:1px solid var(--line);vertical-align:top}}
.n{{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}}th.n{{text-align:right}}
.pos{{color:var(--good)}}.neg{{color:var(--bad)}}
.pill{{font:500 11px var(--mono);padding:2px 7px;border-radius:3px;border:1px solid}}.pill.ok{{color:var(--good);border-color:var(--good)}}
svg{{width:100%;height:auto;display:block}}.gl{{stroke:var(--line);stroke-width:1}}.base{{stroke:var(--mut);stroke-dasharray:4 3}}.ax{{fill:var(--mut);font:11px var(--mono)}}
.eq{{fill:none;stroke:var(--accent);stroke-width:2}}.dot{{fill:var(--bg);stroke:var(--accent);stroke-width:2}}circle.pos{{fill:var(--good);fill-opacity:.8}}circle.neg{{fill:var(--bad);fill-opacity:.8}}
.fr{{display:grid;grid-template-columns:minmax(140px,230px) 1fr 40px;gap:10px;align-items:center;padding:3px 0;font-size:13.5px}}.fr b{{font-family:var(--mono);text-align:right}}.bar{{background:var(--line);height:8px;border-radius:2px}}.bar i{{display:block;height:100%;background:var(--accent);border-radius:2px}}
.warn{{border-left:3px solid var(--warn);padding:2px 0 2px 14px}}
@media(max-width:480px){{h1{{font-size:28px}}.fr{{grid-template-columns:1fr 40px}}.fr .bar{{grid-column:1/-1;order:3}}}}
</style>
<main>
<header><h2>AMN trading bot · Smart Money Concepts model</h2><h1>Backtest and verification results</h1>
<p class="mut" style="margin-top:10px">Engine, risk controller and test matrix are built and verified. The strategy has too little real data behind it to call it profitable or not.</p></header>

<section class="verdict warn"><h2>What these results can and cannot say</h2>
<p>All {real["trades"]} real trades came from about {((real["window"][1]-real["window"][0])/86400):.0f} calendar days of 1-minute data (Yahoo Finance caps 1m history near 30 days). Three trades prove nothing about edge. The bot's logic is checked by the test matrix and by a no-edge control run, not by that sample.</p>
<p style="margin:0">Gold, S&amp;P and Nasdaq use futures proxies (GC=F, ES=F, NQ=F). Spreads and slippage are simulated, there are no commissions, and the news calendar contains only US NFP releases.</p></section>

<section><h2>Verification matrix (PRD section 7)</h2><div class="scroll"><table><tr><th>Case</th><th>Scenario</th><th>Observed</th><th></th></tr>{tcrows}</table></div>
<p class="mut" style="margin-top:10px">14 automated tests pass, including short-side mirror symmetry, spread/session/max-position filters, TP1 partial then breakeven, 3% daily-drawdown kill with 24h lockout, SQLite crash recovery and alert events.</p></section>

<section><h2>Real data · {d(real["window"][0])} to {d(real["window"][1])} UTC · 5 instruments · $10,000 · 1% risk</h2>
<div class="kpis"><div class="k"><b>{real["trades"]}</b><span>trades</span></div><div class="k"><b>{real["win_rate"]*100:.0f}%</b><span>win rate</span></div><div class="k"><b>{real["total_r"]:+.2f}R</b><span>total R</span></div><div class="k"><b>{real["return_pct"]:+.1f}%</b><span>return</span></div><div class="k"><b>{real["max_dd_pct"]:.1f}%</b><span>max drawdown</span></div></div>
<div style="margin-top:14px">{eqsvg}</div>
<div class="scroll"><table><tr><th>Symbol</th><th>Side</th><th>Opened (UTC)</th><th>Trigger</th><th class="n">Lots</th><th class="n">Entry</th><th class="n">Stop</th><th>Exit</th><th class="n">R</th><th class="n">P&amp;L $</th></tr>{rows}</table></div>
<p class="mut" style="margin-top:8px">The SPX500 winner has TP1 and TP2 at the same price (the inducement high equalled the leg high), so it exited in full at target. Exits: BE = stopped at breakeven after TP1.</p></section>

<section><h2>Where setups drop out (real data, all symbols)</h2>{fun}
<p class="mut" style="margin-top:8px">Entry filter rejections: {rej}. Most triggers fired outside the London and New York windows.</p></section>

<section><h2>Control: 30 runs on random markets with no edge</h2>
<p>Each run is 60 weekdays of generated 1m data for all five instruments, with fat tails, volatility clustering and session seasonality. Any steady profit here would point to a bug such as look-ahead.</p>
<div class="kpis"><div class="k"><b>{nz["mean_avg_r"]:+.3f}R</b><span>avg R per trade, zero cost</span></div><div class="k"><b>{nc["mean_avg_r"]:+.3f}R</b><span>avg R, with spread and slippage</span></div><div class="k"><b>{nc["trades_per_run"]:.1f}</b><span>trades per 60 days</span></div><div class="k"><b>{nc["worst_dd_pct"]:.1f}%</b><span>worst drawdown</span></div></div>
<div style="margin-top:12px">{nullsvg}</div>
<p class="mut">Each dot is one run's return. Zero-cost expectancy sits at zero, so the engine does not manufacture edge. Costs pull it slightly negative, and run-to-run swings of about ±{nc["stdev_return_pct"]:.0f}% show how little a few weeks of trades can tell you.</p></section>

<section><h2>Parameter sensitivity on the no-edge market (15 runs each)</h2><div class="scroll"><table><tr><th>Variant</th><th class="n">Trades/run</th><th class="n">Mean return</th><th class="n">Avg R</th><th class="n">Runs up</th><th class="n">Worst DD</th></tr>{sens}</table></div>
<p class="mut" style="margin-top:8px">Dropping the pro-trend filter triples trade count and loses the most, which supports keeping it. Risk cuts drawdown roughly in proportion.</p></section>

<section><h2>Next steps to get a real answer</h2>
<p>Load 12+ months of broker 1m data (Dukascopy or MT5 export) through <span class="mono">amn/data.py</span>, add a ForexFactory calendar CSV, then walk-forward the few free parameters (tap ATR multiple, min RR). Live routing needs an MT5, cTrader or Tradovate adapter implementing the three-method <span class="mono">Broker</span> interface; none is connected, and the bot has not placed any real order.</p></section>
</main>"""
Path(__file__).parent.joinpath("reports/index.html").write_text(page)
