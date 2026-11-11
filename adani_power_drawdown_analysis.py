"""
Adani Power (ADANIPOWER.NS) - 2024 Drawdown & Upside Analysis
Swing High / Swing Low Approach

Data: 1-hour OHLCV candles (yfinance) covering full calendar year 2024.
Note: Free NSE 5-min historical data for 2024 requires premium providers.
      1-hour candles from Yahoo Finance cover NSE trading hours (9:15–15:30 IST)
      and is the finest free granularity available for the full year.

Methodology:
  - Swing High: local maximum where High[i] is greater than the surrounding
    'lookback' bars on both sides.
  - Swing Low : local minimum where Low[i]  is less    than the surrounding
    'lookback' bars on both sides.
  - Drawdown  : percentage drop from a confirmed Swing High to the next
                confirmed Swing Low.
  - Upside    : percentage gain from a confirmed Swing Low  to the next
                confirmed Swing High.
"""

import pandas as pd
import numpy as np
import yfinance as yf
import warnings
warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
# 1. Download hourly data for 2024
# ─────────────────────────────────────────────
print("=" * 65)
print("ADANI POWER (ADANIPOWER.NS) — 2024 Swing Analysis")
print("=" * 65)
print("\nDownloading 1-hour OHLCV data (last 730 days) then filtering to 2024 …",
      end="", flush=True)

ticker = yf.Ticker("ADANIPOWER.NS")
# period="730d" lets yfinance pick the max allowed window from today
raw = ticker.history(period="730d", interval="1h")
raw.index = pd.to_datetime(raw.index)

# Filter strictly to 2024
data = raw[raw.index.year == 2024].copy()
data = data.dropna(subset=["High", "Low", "Close"])

# If hourly 2024 data is incomplete, fill gaps with daily data
daily_raw = ticker.history(start="2024-01-01", end="2024-12-31", interval="1d")
daily_raw.index = pd.to_datetime(daily_raw.index)
daily_2024 = daily_raw[daily_raw.index.year == 2024].dropna(subset=["High", "Low", "Close"])

# Decide which dataset to use
if len(data) < 100:
    print(f"\n  Hourly rows for 2024 too few ({len(data)}), falling back to DAILY data.")
    data = daily_2024
    interval_label = "Daily (1d)"
    LOOKBACK = 3
else:
    interval_label = "Hourly (1h)"
    LOOKBACK = 5

print(f"  Done. {len(data):,} hourly bars loaded.")
print(f"  Period : {data.index[0].strftime('%Y-%m-%d')} → "
      f"{data.index[-1].strftime('%Y-%m-%d')}")
print(f"  Data interval : {interval_label}")
print(f"  Close range   : ₹{data['Close'].min():.2f} – ₹{data['Close'].max():.2f}")

# ─────────────────────────────────────────────
# 2. Swing High / Swing Low detection
# ─────────────────────────────────────────────
# LOOKBACK is set above based on data interval

highs = data["High"].values
lows  = data["Low"].values
closes = data["Close"].values
idx   = data.index

swing_highs = []   # (timestamp, price)
swing_lows  = []   # (timestamp, price)

for i in range(LOOKBACK, len(data) - LOOKBACK):
    window_h = highs[i - LOOKBACK : i + LOOKBACK + 1]
    window_l = lows [i - LOOKBACK : i + LOOKBACK + 1]
    center_idx = LOOKBACK  # position of bar i in the window

    if highs[i] == window_h.max() and np.sum(window_h == highs[i]) == 1:
        swing_highs.append((idx[i], highs[i]))

    if lows[i] == window_l.min() and np.sum(window_l == lows[i]) == 1:
        swing_lows.append((idx[i], lows[i]))

swing_highs_df = pd.DataFrame(swing_highs, columns=["time", "price"]).set_index("time")
swing_lows_df  = pd.DataFrame(swing_lows,  columns=["time", "price"]).set_index("time")

print(f"\n  Swing Highs detected : {len(swing_highs_df)}")
print(f"  Swing Lows  detected : {len(swing_lows_df)}")

# ─────────────────────────────────────────────
# 3. Build alternating swing sequence
#    (ensures we alternate H→L→H→L …)
# ─────────────────────────────────────────────
all_swings = (
    pd.concat([
        swing_highs_df.assign(kind="H"),
        swing_lows_df.assign(kind="L"),
    ])
    .sort_index()
)

# Keep only alternating H/L, taking the extreme value when consecutive same-type
sequence = []
for _, row in all_swings.iterrows():
    if not sequence:
        sequence.append(row)
    elif sequence[-1]["kind"] == row["kind"]:
        # same type: keep the more extreme one
        if row["kind"] == "H" and row["price"] > sequence[-1]["price"]:
            sequence[-1] = row
        elif row["kind"] == "L" and row["price"] < sequence[-1]["price"]:
            sequence[-1] = row
    else:
        sequence.append(row)

seq_df = pd.DataFrame(sequence)

# ─────────────────────────────────────────────
# 4. Calculate drawdowns and upsides
# ─────────────────────────────────────────────
drawdowns = []
upsides   = []

for i in range(len(seq_df) - 1):
    curr = seq_df.iloc[i]
    nxt  = seq_df.iloc[i + 1]

    if curr["kind"] == "H" and nxt["kind"] == "L":
        pct = (nxt["price"] - curr["price"]) / curr["price"] * 100  # negative
        drawdowns.append({
            "from_time"  : curr.name,
            "to_time"    : nxt.name,
            "from_price" : curr["price"],
            "to_price"   : nxt["price"],
            "drawdown_%" : round(pct, 3),
        })

    elif curr["kind"] == "L" and nxt["kind"] == "H":
        pct = (nxt["price"] - curr["price"]) / curr["price"] * 100  # positive
        upsides.append({
            "from_time"  : curr.name,
            "to_time"    : nxt.name,
            "from_price" : curr["price"],
            "to_price"   : nxt["price"],
            "upside_%"   : round(pct, 3),
        })

dd_df = pd.DataFrame(drawdowns)
up_df = pd.DataFrame(upsides)

# ─────────────────────────────────────────────
# 5. Statistics
# ─────────────────────────────────────────────
print("\n" + "=" * 65)
print("DRAWDOWNS  (Swing High → next Swing Low)")
print("=" * 65)
if len(dd_df):
    dd_vals = dd_df["drawdown_%"].abs()
    print(f"  Count             : {len(dd_df)}")
    print(f"  Smallest drawdown : -{dd_vals.min():.3f}%")
    print(f"  Average drawdown  : -{dd_vals.mean():.3f}%")
    print(f"  Largest drawdown  : -{dd_vals.max():.3f}%")
    print(f"  Std deviation     : {dd_vals.std():.3f}%")
    print()
    print("  Top 10 Largest Drawdowns:")
    top_dd = dd_df.nsmallest(10, "drawdown_%")[
        ["from_time", "to_time", "from_price", "to_price", "drawdown_%"]
    ].copy()
    top_dd["from_time"] = top_dd["from_time"].dt.strftime("%Y-%m-%d %H:%M")
    top_dd["to_time"]   = top_dd["to_time"].dt.strftime("%Y-%m-%d %H:%M")
    top_dd["from_price"] = top_dd["from_price"].round(2)
    top_dd["to_price"]   = top_dd["to_price"].round(2)
    print(top_dd.to_string(index=False))

print("\n" + "=" * 65)
print("UPSIDES  (Swing Low → next Swing High)")
print("=" * 65)
if len(up_df):
    up_vals = up_df["upside_%"]
    print(f"  Count           : {len(up_df)}")
    print(f"  Smallest upside : +{up_vals.min():.3f}%")
    print(f"  Average upside  : +{up_vals.mean():.3f}%")
    print(f"  Largest upside  : +{up_vals.max():.3f}%")
    print(f"  Std deviation   : {up_vals.std():.3f}%")
    print()
    print("  Top 10 Largest Upsides:")
    top_up = up_df.nlargest(10, "upside_%")[
        ["from_time", "to_time", "from_price", "to_price", "upside_%"]
    ].copy()
    top_up["from_time"] = top_up["from_time"].dt.strftime("%Y-%m-%d %H:%M")
    top_up["to_time"]   = top_up["to_time"].dt.strftime("%Y-%m-%d %H:%M")
    top_up["from_price"] = top_up["from_price"].round(2)
    top_up["to_price"]   = top_up["to_price"].round(2)
    print(top_up.to_string(index=False))

# ─────────────────────────────────────────────
# 6. Distribution buckets
# ─────────────────────────────────────────────
print("\n" + "=" * 65)
print("DRAWDOWN DISTRIBUTION BUCKETS (% range)")
print("=" * 65)
buckets = [(0, 1), (1, 2), (2, 3), (3, 5), (5, 8), (8, 12), (12, 20), (20, 100)]
dd_abs = dd_df["drawdown_%"].abs()
for lo, hi in buckets:
    cnt = ((dd_abs >= lo) & (dd_abs < hi)).sum()
    bar = "█" * cnt
    print(f"  {lo:>4}% – {hi:>3}%  :  {cnt:>3} moves  {bar}")

print("\n" + "=" * 65)
print("UPSIDE DISTRIBUTION BUCKETS (% range)")
print("=" * 65)
for lo, hi in buckets:
    cnt = ((up_vals >= lo) & (up_vals < hi)).sum()
    bar = "█" * cnt
    print(f"  {lo:>4}% – {hi:>3}%  :  {cnt:>3} moves  {bar}")

# ─────────────────────────────────────────────
# 7. Save to CSV
# ─────────────────────────────────────────────
dd_df.to_csv("/home/user/Development_FullStackTestVarun/adani_power_drawdowns_2024.csv", index=False)
up_df.to_csv("/home/user/Development_FullStackTestVarun/adani_power_upsides_2024.csv", index=False)

print(f"\n  Drawdown table saved → adani_power_drawdowns_2024.csv")
print(f"  Upside   table saved → adani_power_upsides_2024.csv")
print("\n" + "=" * 65)
print("Note: Analysis uses 1-hour OHLCV candles (Yahoo Finance).")
print("      True 5-min NSE historical data for 2024 requires a")
print("      premium data subscription (Zerodha Kite, Refinitiv, etc.)")
print(f"      Data interval used : {interval_label}")
print(f"      Lookback           : {LOOKBACK} bars each side")
print("=" * 65)
