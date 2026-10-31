# Nifty 500 Hourly Mover Screener

Finds NSE Nifty 500 stocks that **surged or plunged 15%-20% within a single
trading hour** — a finer-grained sibling of [`../nifty500-screener`](../nifty500-screener),
which screens the same band on a *daily* close-to-close basis. This project
is independent and self-contained; it doesn't import from the daily one.

## How it works

1. **Constituent list** — same source and caching approach as the daily
   screener: NSE's official archive (`ind_nifty500list.csv`), cached to
   `data/nifty500_list.csv` with a bundled fallback snapshot.
2. **Prices** — Yahoo Finance's public chart endpoint, requested with
   `interval=60m` instead of `1d`, giving one candle per trading hour
   (NSE's 09:15-15:30 IST session yields ~6-7 bars/day).
3. **Filter** — for each stock, compare one hourly candle's close against
   the *previous* hourly candle's close. A stock is flagged if
   `abs(% change)` falls in `[min-pct, max-pct]` (default 15-20%), labeled
   `SURGE` or `PLUNGE`. The overnight gap between yesterday's last hour and
   today's first hour is explicitly excluded, so a stock that merely opened
   15% higher isn't misreported as an "hourly" move.
4. **Modes**:
   - **Live**: the hour that's happening right now — the latest (still
     forming) candle vs. the last *completed* hour's close. Meant to be
     re-run periodically during market hours (`--watch`).
   - **End of Day**: walks every completed hour of the latest session and,
     per stock, reports the single largest hour-over-hour move that falls
     in the band — i.e. "did this stock have *any* hour today that moved
     15-20%, and which hour was it?" Safe to run any time, including after
     the close.

Prices are delayed a few minutes (unofficial Yahoo endpoint) and this tool
is for screening/research only — **not** a source of truth for trading
decisions.

## Setup

```bash
cd nifty500-screener-hourly
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Dashboard app

```bash
streamlit run app.py
```

Opens at `http://localhost:8501` with a mode toggle (Live / End of Day), a
slider for the % band, a market open/closed banner, a color-coded results
table (showing which hour each move happened in), a bar chart, CSV
download, and optional auto-refresh during market hours.

## CLI usage

Scan the hour happening right now:

```bash
python -m nifty500_screener_hourly.cli --mode live
```

Scan every completed hour of the latest session:

```bash
python -m nifty500_screener_hourly.cli --mode eod
```

Re-scan every 5 minutes while the market is open:

```bash
python -m nifty500_screener_hourly.cli --mode live --watch --interval 300
```

### All options

```
--mode {live,eod}       default: live
--min-pct FLOAT         default: 15
--max-pct FLOAT         default: 20
--workers INT           concurrent HTTP requests, default: 20
--out PATH              CSV file or directory, default: output/
--refresh-list          force re-download of the Nifty 500 constituent list
--force                 run live scan even if the market looks closed
--watch                 repeat on an interval (live mode only)
--interval SECONDS      default: 300
-v / --verbose          debug logging
```

## Scheduling

```cron
# Live sweep every 15 min while NSE is open (IST = UTC+5:30 -> 03:45-10:00 UTC)
*/15 3-9 * * 1-5 cd /path/to/nifty500-screener-hourly && .venv/bin/python -m nifty500_screener_hourly.cli --mode live >> output/live.log 2>&1
0 10 * * 1-5       cd /path/to/nifty500-screener-hourly && .venv/bin/python -m nifty500_screener_hourly.cli --mode live >> output/live.log 2>&1

# Full end-of-day hourly sweep once the market has closed (15:30 IST = 10:00 UTC)
5 10 * * 1-5 cd /path/to/nifty500-screener-hourly && .venv/bin/python -m nifty500_screener_hourly.cli --mode eod >> output/eod.log 2>&1
```

NSE trading holidays aren't accounted for (same caveat as the daily
screener) — a scan on a holiday just won't find any fresh movement.

## Project layout

```
app.py                       # Streamlit dashboard
nifty500_screener_hourly/
  constituents.py          # Nifty 500 list fetch + on-disk cache
  yahoo_client.py           # hourly-candle HTTP client
  market_hours.py           # NSE trading-hours check (IST)
  screener.py                # classification + concurrent hourly scanning
  cli.py                      # argparse entrypoint, table/CSV output, --watch loop
data/
  nifty500_list.csv          # cached/bundled constituent snapshot
output/                       # generated CSVs (gitignored)
tests/
  test_screener.py            # unit tests (mocked, no network)
```

## Running tests

```bash
python -m unittest discover -s tests -v
```

## Limitations

- Same unofficial-API and no-corporate-action-adjustment caveats as the
  daily screener.
- Yahoo's 60-minute bars are session-anchored (first bar starts at NSE's
  09:15 open), not wall-clock-aligned; "the last hour" means the last
  bar in that sequence, not literally the last 60 minutes of clock time.
- EOD mode reports only the single largest in-band hourly move per stock
  per day, not every qualifying hour — a stock with two separate 15%+
  hourly swings in one day only shows its biggest one.
