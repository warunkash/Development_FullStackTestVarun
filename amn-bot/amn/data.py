"""Data loading, HTF aggregation and a synthetic (no-edge) market generator."""
import csv
import math
import random
from datetime import datetime, timezone

from .engine import Bar


def load_csv(path):
    bars = []
    with open(path) as f:
        r = csv.reader(f)
        next(r)
        for ts, o, h, l, c in r:
            bars.append(Bar(int(ts), float(o), float(h), float(l), float(c)))
    return bars


def nfp_events(start_ts, end_ts):
    """Placeholder high-impact calendar: US NFP, first Friday 12:30 UTC.
    Replace with a ForexFactory export (ts per line) for real use."""
    out = []
    d = datetime.fromtimestamp(start_ts, timezone.utc).replace(day=1, hour=12, minute=30, second=0, microsecond=0)
    while d.timestamp() <= end_ts:
        first = d
        while first.weekday() != 4:
            first = first.replace(day=first.day + 1)
        if start_ts <= first.timestamp() <= end_ts:
            out.append(int(first.timestamp()))
        d = d.replace(year=d.year + (d.month == 12), month=d.month % 12 + 1)
    return out


ANNUAL_VOL = {"EURUSD": 0.07, "GBPUSD": 0.08, "XAUUSD": 0.15, "SPX500": 0.16, "NAS100": 0.21}
START_PX = {"EURUSD": 1.10, "GBPUSD": 1.30, "XAUUSD": 2400.0, "SPX500": 5500.0, "NAS100": 19000.0}


def synthetic(symbol, days, seed, start_ts=1_751_328_000):
    """Driftless random walk with fat tails (t, df=4), GARCH-like vol clustering and
    intraday vol seasonality (London/NY busier). Weekdays only, 24h. By
    construction there is NO exploitable edge -- this is the null-hypothesis control."""
    rng = random.Random(f"{symbol}-{seed}")
    base = ANNUAL_VOL[symbol] / math.sqrt(252 * 1440)
    px = START_PX[symbol]
    bars, vol = [], 1.0
    ts = start_ts - start_ts % 86400
    d = 0
    while d < days:
        if datetime.fromtimestamp(ts, timezone.utc).weekday() < 5:
            for m in range(1440):
                h = m // 60
                seas = 1.6 if 7 <= h < 16 else (0.6 if h < 6 or h >= 21 else 1.0)
                # t(4) shock
                z = rng.gauss(0, 1) / math.sqrt(rng.gammavariate(2, 1) / 2) * 0.7071
                vol = 0.97 * vol + 0.03 * 1.0 + 0.05 * (abs(z) - 0.8)
                vol = max(0.4, min(vol, 4))
                sig = base * seas * vol * px
                o = px
                c = o + z * sig
                wick = abs(rng.gauss(0, 0.5)) * sig
                h_ = max(o, c) + abs(rng.gauss(0, 0.5)) * sig
                l_ = min(o, c) - wick
                bars.append(Bar(ts + m * 60, o, h_, l_, c))
                px = c
            d += 1
        ts += 86400
    return bars
