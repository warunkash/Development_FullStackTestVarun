"""Full evaluation: real 1m data (small sample) + synthetic no-edge Monte Carlo control."""
import csv, json, statistics as st, time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from amn.backtest import run_backtest
from amn.config import Config, INSTRUMENTS
from amn.data import load_csv, nfp_events, synthetic
from amn.execution import SimBroker
from amn.metrics import summarize

ROOT = Path(__file__).parent
SYMS = ["EURUSD", "GBPUSD", "XAUUSD", "SPX500", "NAS100"]


class ZeroCost(SimBroker):
    def spread(self, symbol, ts): return 0.0
    def market_order(self, symbol, d, lots, ref, ts): return ref, 0.0, 0.0
    def close(self, symbol, d, lots, price, ts): return price


def one(args):
    seed, days, zero, overrides = args
    data = {s: synthetic(s, days, seed) for s in SYMS}
    cfg = Config(**overrides)
    res = run_backtest(data, cfg, broker=ZeroCost() if zero else None, seed=seed)
    m = summarize(res["trader"], cfg.balance)
    return dict(seed=seed, signals=res["signals"], **{k: m[k] for k in
                ("trades", "wins", "return_pct", "total_r", "avg_r", "max_dd_pct", "dd_kills")})


def mc(seeds, days, zero, overrides=None):
    with ProcessPoolExecutor() as ex:
        return list(ex.map(one, [(s, days, zero, overrides or {}) for s in seeds]))


def agg(rows):
    r = [x["return_pct"] for x in rows]
    n = sum(x["trades"] for x in rows)
    return dict(runs=len(rows), trades=n, trades_per_run=n / len(rows),
                mean_return_pct=st.mean(r), median_return_pct=st.median(r),
                stdev_return_pct=st.pstdev(r), pct_runs_profitable=100 * sum(v > 0 for v in r) / len(r),
                mean_avg_r=st.mean(x["avg_r"] for x in rows if x["trades"]),
                worst_dd_pct=max(x["max_dd_pct"] for x in rows), dd_kills=sum(x["dd_kills"] for x in rows))


if __name__ == "__main__":
    out = {}
    # ---- real data
    data = {s: load_csv(ROOT / "data" / f"{s}_1m.csv") for s in SYMS}
    t0 = min(b[0].ts for b in data.values()); t1 = max(b[-1].ts for b in data.values())
    cfg = Config()
    res = run_backtest(data, cfg, news_ts=nfp_events(t0, t1))
    m = summarize(res["trader"], cfg.balance)
    out["real"] = {k: v for k, v in m.items() if k != "r_list"}
    out["real"].update(window=[t0, t1], setups_reaching_trigger=res["signals"],
                       bars={s: len(b) for s, b in data.items()})
    out["real"]["equity"] = res["trader"].equity_curve
    out["real"]["trades_detail"] = [
        dict(symbol=t.symbol, side="BUY" if t.d > 0 else "SELL", open_ts=t.open_ts, close_ts=t.close_ts,
             lots=t.lots, entry=t.entry, sl=t.sl0, tp1=t.tp1, tp2=t.tp2, trigger=t.trigger,
             exit=t.exit_reason, pnl=t.pnl, r=t.pnl / t.risk_ccy) for t in res["trader"].closed]
    out["real"]["state_events"] = {}
    for s, e in res["engines"].items():
        c = {}
        for l in e.log:
            c[l[3]] = c.get(l[3], 0) + 1
        out["real"]["state_events"][s] = c
    # ---- synthetic no-edge controls
    seeds = list(range(1, 31))
    t = time.time()
    rows_cost = mc(seeds, 60, False)
    rows_zero = mc(seeds, 60, True)
    out["null_with_costs"], out["null_zero_cost"] = agg(rows_cost), agg(rows_zero)
    out["null_runs"] = rows_cost
    out["null_secs"] = round(time.time() - t, 1)
    # ---- sensitivity on the null + costs
    sens = {}
    for name, ov in {"default (min RR 2, continuation)": {}, "min RR 1.0": {"min_rr": 1.0},
                     "min RR 3.0": {"min_rr": 3.0}, "no continuation filter": {"require_continuation": False},
                     "risk 0.5%": {"risk_pct": 0.5}}.items():
        sens[name] = agg(mc(seeds[:15], 60, False, ov))
    out["sensitivity_null"] = sens
    (ROOT / "reports").mkdir(exist_ok=True)
    (ROOT / "reports" / "results.json").write_text(json.dumps(out, indent=1, default=str))
    with open(ROOT / "reports" / "real_trades.csv", "w", newline="") as f:
        rows = out["real"]["trades_detail"]
        w = csv.DictWriter(f, fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)
    print(json.dumps({k: out[k] for k in ("null_with_costs", "null_zero_cost", "sensitivity_null", "null_secs")}, indent=1))
    print(json.dumps({k: v for k, v in out["real"].items() if k not in ("equity", "trades_detail")}, indent=1))
