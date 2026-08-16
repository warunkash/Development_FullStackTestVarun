# Market Structure Bot

Reads NSE intraday candles, marks the swing points a market-structure
indicator would draw — **High / Low / HH / HL / LH / LL** — and alerts when
price breaks one of those swings.

Two kinds of break matter:

| | Meaning | Example |
|---|---|---|
| **BOS** — Break of Structure | Price breaks *with* the trend. Continuation. | An uptrend closes above its last swing high |
| **CHoCH** — Change of Character | Price breaks *against* the trend. The trend state flips. | A downtrend closes above its last swing high |

## How it works

1. **Candles** — Yahoo Finance's public chart endpoint (`TATAPOWER.NS`, i.e.
   NSE symbol + `.NS`). No API key. Intraday intervals `1m`-`1h` plus `1d`.
2. **Swings** — a bar is a swing high when its high is the highest across
   `depth` bars either side (swing low: the lowest). This is the standard
   fractal rule, and `--depth` is the one knob that decides whether you get
   every wiggle or only the meaningful turns.
3. **Alternation** — structure has to alternate high, low, high, low. Two
   swing highs in a row collapse to the higher one; two lows to the lower.
   `--min-swing-pct` additionally throws away legs too small to be structure.
4. **Labels** — each swing is compared with the previous swing of the same
   kind: higher high → `HH`, lower high → `LH`, higher low → `HL`, lower low
   → `LL`. The first swing of each kind is just `High` / `Low`. An *equal*
   high counts as `LH` — it failed to make a new extreme.
5. **Trend** — `HH` + `HL` is an uptrend, `LH` + `LL` a downtrend, anything
   mixed is a range.
6. **Breaks** — a close beyond the last swing high/low fires a signal, tagged
   BOS or CHoCH depending on the trend at that moment. Each level fires at
   most once. The signal carries a stop at the opposing swing and a target at
   `--reward-multiple` × risk.

### Two things worth knowing before you trust a signal

**Signals are confirmed `depth` bars late.** A swing high is not a swing high
until `depth` more bars have printed without exceeding it. On a 5m chart with
`--depth 3` that is 15 minutes of lag, and no setting removes it — it is what
"confirmed swing" means.

**The signal history is a replay, not a backtest.** Candles are walked one at
a time and a pivot only enters the picture at the bar where it became
knowable, so a signal listed for 11:05 is one the bot would genuinely have
produced at 11:05. What the history does *not* include is slippage,
liquidity, or whether the trade actually worked — the stop and target columns
are geometry, not results.

## Setup

```bash
cd market-structure-bot
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## CLI usage

Structure and breaks for one symbol:

```bash
python -m market_structure_bot.cli --symbol TATAPOWER
```

```
TATAPOWER  5m  last 382.05  trend DOWN  (last closed bar 14 Aug 15:15 IST)

Swing structure (most recent last):
Time (IST)    Swing  Label  Price
----------------------------------
14 Aug 10:25  HIGH   HH     386.95
14 Aug 10:40  LOW    HL     385.05
14 Aug 11:20  HIGH   HH     389.95
14 Aug 13:35  LOW    LL     384.00
14 Aug 13:50  HIGH   LH     384.95

Structure breaks:
Time (IST)    Type   Dir      Broke  Level   Close   Stop    Target  Risk
--------------------------------------------------------------------------
14 Aug 11:40  BOS    bullish  HH     389.95  390.00  385.05  399.90  1.27%
14 Aug 12:55  CHoCH  bearish  HL     388.60  386.55  390.40  378.85  1.00%
14 Aug 14:20  BOS    bearish  LL     384.00  383.80  384.95  381.50  0.30%
```

Sweep a watchlist for symbols that broke structure in the last 3 bars:

```bash
python -m market_structure_bot.cli --scan --max-age-bars 3
```

Keep sweeping every 5 minutes while NSE is open, announcing only breaks it
has not already announced:

```bash
python -m market_structure_bot.cli --scan --watch --interval-seconds 300
```

Fewer, bigger swings on the 15m chart — CHoCH only, own watchlist:

```bash
python -m market_structure_bot.cli --scan \
  --symbols TATAPOWER,RELIANCE,SBIN --interval 15m \
  --depth 5 --min-swing-pct 0.5 --kinds CHoCH
```

Machine-readable output for piping somewhere else:

```bash
python -m market_structure_bot.cli --symbol TATAPOWER --json
python -m market_structure_bot.cli --scan --out output/            # timestamped CSV
python -m market_structure_bot.cli --scan --out output/signals.json
```

### All options

```
--symbol SYMBOL         single NSE symbol, e.g. TATAPOWER
--scan                  sweep a watchlist instead of one symbol
--symbols A,B,C         comma-separated watchlist for --scan
--symbols-file PATH     file with one symbol per line
--interval STR          candle interval, default: 5m
--lookback STR          history to load, default: 1mo

--depth INT             bars either side of a swing point, default: 3
--min-swing-pct FLOAT   ignore swings smaller than this % move, default: 0 (off)
--reward-multiple FLOAT target as a multiple of risk, default: 2.0
--use-wicks             break on wicks instead of closes (earlier, noisier)
--include-forming       include the still-forming bar (its high/low can change)

--max-age-bars INT      --scan: only report breaks this recent, default: 3
--kinds BOS,CHoCH       signal types to report
--limit INT             rows of history to print, default: 12
--json                  JSON instead of tables
--out PATH              write results to a CSV/JSON file or directory
--workers INT           concurrent fetches, default: 8

--watch                 re-run on an interval
--interval-seconds INT  seconds between passes, default: 300
--force                 run even when NSE looks closed
-v / --verbose          debug logging
```

## Dashboard

```bash
streamlit run app.py
```

A dark candlestick chart with the zig-zag between confirmed swings, HH/HL/LH/LL
labels, dotted lines at broken levels and BOS/CHoCH markers — plus the same
structure-tuning knobs as the CLI, a watchlist-scan tab, and a CSV download.

## Tuning `--depth`

`--depth` is the difference between "every wiggle" and "the turns that
matter". On the 5m chart:

| depth | Effect |
|---|---|
| 1-2 | Very noisy. Dozens of swings a day, most of them meaningless. |
| **3** | Default. Roughly what a chart indicator draws on 5m. |
| 5-8 | Only the session's real turning points. Slower to confirm. |

Pair a low depth with `--min-swing-pct` if you want fast confirmation without
labeling every 0.1% wiggle as structure.

## Scheduling

```cron
# Sweep every 15 min while NSE is open (IST = UTC+5:30 -> 03:45-10:00 UTC)
*/15 3-9 * * 1-5 cd /path/to/market-structure-bot && .venv/bin/python -m market_structure_bot.cli --scan --out output/ >> output/scan.log 2>&1
```

## Project layout

```
app.py                        # Streamlit dashboard
market_structure_bot/
  candles.py                  # Yahoo intraday OHLC fetch + payload parsing
  structure.py                # fractal swings, alternation, HH/HL/LH/LL labels, trend
  signals.py                  # BOS / CHoCH replay (no lookahead)
  watchlist.py                # concurrent multi-symbol scan + freshness filter
  market_hours.py             # NSE trading-hours check (IST)
  cli.py                      # argparse entrypoint, tables, --watch loop
tests/                        # 65 unit tests, fully mocked — no network
output/                       # generated CSV/JSON (gitignored)
```

## Running tests

```bash
python -m unittest discover -s tests -t tests -v
```

## Limitations

- **Signals only — it does not place orders.** There is no broker integration
  and no position tracking; the bot tells you structure broke, you decide
  what to do about it.
- Yahoo's chart endpoint is unofficial, delayed a few minutes, and can
  rate-limit or change without notice. `--workers` controls concurrency if
  you get throttled.
- `1m` data goes back 7 days; `5m`-`1h` about 60 days. Longer `--lookback`
  values are clamped to what the interval actually serves.
- NSE trading holidays are not modelled — `--watch` will just find nothing on
  a holiday.
- A bar that takes out both the swing high and the swing low produces no
  signal. OHLC does not say which side was hit first, and guessing would be
  worse than staying quiet.
- Structure is read on one timeframe at a time. A 5m CHoCH against a clear
  daily downtrend is still a 5m CHoCH; the bot does not know about the daily.

Research and screening only — not financial advice.
