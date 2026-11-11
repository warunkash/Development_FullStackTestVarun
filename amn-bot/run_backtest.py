import json, sys, time
from pathlib import Path
from amn.backtest import run_backtest
from amn.config import Config
from amn.data import load_csv, nfp_events
from amn.metrics import summarize

D = Path(__file__).parent / "data"
syms = ["EURUSD", "GBPUSD", "XAUUSD", "SPX500", "NAS100"]
data = {s: load_csv(D / f"{s}_1m.csv") for s in syms}
t0 = min(b[0].ts for b in data.values()); t1 = max(b[-1].ts for b in data.values())
news = nfp_events(t0, t1)
print("window", t0, t1, "bars", {s: len(b) for s, b in data.items()}, "news", news)
cfg = Config()
st = time.time()
res = run_backtest(data, cfg, news_ts=news)
print("secs", round(time.time() - st, 1), "signals", res["signals"])
m = summarize(res["trader"], cfg.balance)
m.pop("r_list")
print(json.dumps(m, indent=1, default=str))
for s, e in res["engines"].items():
    c = {}
    for l in e.log:
        c[l[3]] = c.get(l[3], 0) + 1
    print(s, c)
