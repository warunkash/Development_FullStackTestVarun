"""Download 1m OHLC from Yahoo Finance (last ~30 days; Yahoo caps 1m history).

Proxies: EURUSD=X, GBPUSD=X spot FX; GC=F (gold futures) for XAUUSD;
ES=F / NQ=F (index futures) for SPX500 / NAS100.
"""
import csv, json, sys, time, urllib.request
from pathlib import Path

TICKERS = {"EURUSD": "EURUSD=X", "GBPUSD": "GBPUSD=X", "XAUUSD": "GC=F",
           "SPX500": "ES=F", "NAS100": "NQ=F"}
DATA = Path(__file__).resolve().parent.parent / "data"


def fetch_chunk(ticker, p1, p2):
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
           f"?interval=1m&period1={p1}&period2={p2}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        res = json.load(r)["chart"]["result"][0]
    q = res["indicators"]["quote"][0]
    rows = []
    for i, t in enumerate(res.get("timestamp", [])):
        o, h, l, c = q["open"][i], q["high"][i], q["low"][i], q["close"][i]
        if None in (o, h, l, c):
            continue
        rows.append((t, o, h, l, c))
    return rows


def main(days=28):
    DATA.mkdir(exist_ok=True)
    now = int(time.time())
    for sym, tk in TICKERS.items():
        seen = {}
        end = now
        while end > now - days * 86400:
            start = end - 6 * 86400
            try:
                for r in fetch_chunk(tk, start, end):
                    seen[r[0]] = r
            except Exception as e:  # noqa: BLE001
                print(sym, "chunk failed", e, file=sys.stderr)
            end = start
            time.sleep(0.5)
        rows = [seen[k] for k in sorted(seen)]
        with open(DATA / f"{sym}_1m.csv", "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["ts", "open", "high", "low", "close"])
            w.writerows(rows)
        print(sym, len(rows), "bars")


if __name__ == "__main__":
    main()
