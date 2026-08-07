# Nifty 500 Daily Mover Screener

Finds NSE Nifty 500 stocks that **surged or plunged 15%-20% in a single day**,
either right now during market hours (**intraday**) or after the close using
official closing prices (**end-of-day**).

## How it works

1. **Constituent list** — downloaded from NSE's official archive
   (`ind_nifty500list.csv`) and cached to `data/nifty500_list.csv`. A snapshot
   is committed so the tool still works if NSE is temporarily unreachable.
2. **Prices** — fetched from Yahoo Finance's public chart endpoint
   (`RELIANCE.NS`, `TCS.NS`, ... i.e. NSE symbol + `.NS`). No API key needed.
   - **Intraday mode**: live/last traded price vs. the previous session's
     official close.
   - **EOD mode**: the latest *completed* session's official close vs. the
     prior session's close (works correctly no matter what time you run it).
3. **Filter** — a stock is flagged if `abs(% change)` falls in `[min-pct, max-pct]`
   (default 15-20%), labeled `SURGE` (positive) or `PLUNGE` (negative).

Prices from the unofficial Yahoo endpoint are typically delayed a few
minutes and this tool is for screening/research only — **not** a source of
truth for trading decisions.

## Setup

```bash
cd nifty500-screener
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Dashboard app

A [Streamlit](https://streamlit.io) app (`app.py`) wraps the screener in an
interactive UI:

```bash
streamlit run app.py
```

Then open the printed local URL (default `http://localhost:8501`). It gives
you:

- A mode toggle (**Intraday** vs **End of Day**) and a slider for the % move
  band (default 15-20%).
- A market-open/closed banner (Mon-Fri 09:15-15:30 IST) so it's clear when
  Intraday numbers are live vs. stale.
- A results table (Symbol, Company, Direction, % Change, Prev Close,
  Current, timestamp), color-coded green for Surge / red for Plunge, plus a
  bar chart of the moves.
- A **Download CSV** button for the current scan.
- Optional **auto-refresh** (Intraday mode) that re-scans on a configurable
  interval while you keep the tab open.
- A **Force refresh Nifty 500 list** button if NSE has published an index
  rebalance since the cached list was last pulled.

This is a single-user dashboard (the auto-refresh loop blocks that session
while waiting), which is the right shape for one person watching the market
during the day — it isn't meant to be deployed for many concurrent viewers.

## CLI usage

Intraday scan (only runs during NSE hours, Mon-Fri 09:15-15:30 IST, unless `--force`):

```bash
python -m nifty500_screener.cli --mode intraday
```

End-of-day scan (compares the last two official closes, safe to run anytime):

```bash
python -m nifty500_screener.cli --mode eod
```

Keep scanning every 5 minutes while the market is open, saving a timestamped
CSV each pass:

```bash
python -m nifty500_screener.cli --mode intraday --watch --interval 300
```

Custom band, e.g. 10%-15% movers:

```bash
python -m nifty500_screener.cli --mode eod --min-pct 10 --max-pct 15
```

Every run also prints a console table and writes a CSV to `output/` (override
with `--out path/to/file.csv`, or `--out ""` to skip writing).

### All options

```
--mode {intraday,eod}   default: intraday
--min-pct FLOAT         default: 15
--max-pct FLOAT         default: 20
--workers INT           concurrent HTTP requests, default: 20
--out PATH              CSV file or directory, default: output/
--refresh-list          force re-download of the Nifty 500 constituent list
--force                 run intraday scan even if the market looks closed
--watch                 repeat on an interval (intraday only)
--interval SECONDS      default: 300
-v / --verbose          debug logging
```

## Scheduling it for real "during the day + end of day" coverage

Run it unattended with cron (adjust the path/venv):

```cron
# Intraday sweep every 15 min while NSE is open (IST = UTC+5:30 -> 03:45-10:00 UTC)
*/15 3-9 * * 1-5 cd /path/to/nifty500-screener && .venv/bin/python -m nifty500_screener.cli --mode intraday >> output/intraday.log 2>&1
0 10 * * 1-5      cd /path/to/nifty500-screener && .venv/bin/python -m nifty500_screener.cli --mode intraday >> output/intraday.log 2>&1

# End-of-day summary once the market has closed (15:30 IST = 10:00 UTC)
5 10 * * 1-5 cd /path/to/nifty500-screener && .venv/bin/python -m nifty500_screener.cli --mode eod >> output/eod.log 2>&1
```

NSE trading holidays (Diwali, Republic Day, etc.) aren't accounted for — a
scan on a holiday just won't find any fresh price movement.

## Project layout

```
app.py                 # Streamlit dashboard
nifty500_screener/
  constituents.py   # Nifty 500 list fetch + on-disk cache
  yahoo_client.py    # HTTP client for live quotes and daily closes
  market_hours.py    # NSE trading-hours check (IST)
  screener.py         # classification + concurrent scanning
  cli.py              # argparse entrypoint, table/CSV output, --watch loop
data/
  nifty500_list.csv   # cached/bundled constituent snapshot
output/                # generated CSVs (gitignored)
tests/
  test_screener.py     # unit tests for classification & scanning (mocked, no network)
```

## Running tests

```bash
python -m unittest discover -s tests -v
```

## Limitations

- Yahoo Finance's chart endpoint is unofficial/undocumented and can change or
  rate-limit without notice; `--workers` controls request concurrency if you
  hit throttling.
- No corporate-action adjustment beyond what Yahoo's `previousClose` already
  reflects (e.g. a stock split can look like a "plunge" on the split day).
- Circuit-limit stocks (price frozen at the exchange's daily limit) will
  still show up correctly since the limit price itself is the move.
