"""Event-driven multi-symbol backtest. 1m bars drive everything; 15m bars are
aggregated on the fly and handed to the engine the moment they complete."""
from collections import defaultdict

from .config import Config, INSTRUMENTS
from .engine import AMNEngine, Bar, IDLE
from .execution import NewsFilter, SimBroker, Trader


class Agg:
    """Aggregates 1m -> HTF bars without look-ahead."""

    def __init__(self, minutes):
        self.sec = minutes * 60
        self.cur = None

    def push(self, b):
        """Returns a finished HTF bar if `b` completes (or follows) one."""
        bucket = b.ts - b.ts % self.sec
        done = None
        if self.cur is not None and self.cur.ts != bucket:
            done, self.cur = self.cur, None          # gap: close the stale bucket
        if self.cur is None:
            self.cur = Bar(bucket, b.o, b.h, b.l, b.c)
        else:
            c = self.cur
            c.h, c.l, c.c = max(c.h, b.h), min(c.l, b.l), b.c
        return done

    def flush_if_complete(self, b):
        if b.ts % self.sec == self.sec - 60 and self.cur is not None:
            done, self.cur = self.cur, None
            return done
        return None


def run_backtest(data, cfg: Config = None, news_ts=(), seed=7, notifier=None, broker=None):
    cfg = cfg or Config()
    engines = {s: AMNEngine(s, cfg) for s in data}
    aggs = {s: Agg(cfg.htf_minutes) for s in data}
    trader = Trader(cfg, broker or SimBroker(seed), NewsFilter(news_ts, cfg.news_window_min), notifier)
    events = sorted(((b.ts, s, i) for s, bars in data.items() for i, b in enumerate(bars)))
    last = {}
    signals = set()

    def cb(sym):
        engines[sym].on_trade_closed()

    def htf(sym, hb):
        engines[sym].on_htf_bar(hb)

    for ts, sym, i in events:
        b = data[sym][i]
        last[sym] = b.c
        eng = engines[sym]
        # a stale HTF bucket from before a gap is closed before the new bar
        done = aggs[sym].push(b)
        if done:
            htf(sym, done)
        trader.on_bar(sym, b, cb)
        sig = eng.on_ltf_bar(b)
        if sig:
            signals.add((sym, id(eng.setup)))   # distinct setups that reached a trigger
            pos = trader.try_enter(sig, last)
            if pos:
                eng.on_order_filled()
        done = aggs[sym].flush_if_complete(b)
        if done:
            htf(sym, done)
        trader.on_tick_equity(ts, last, cb)
    if trader.positions:
        trader.close_all(last, events[-1][0], "END", cb)
    return dict(trader=trader, engines=engines, signals=len(signals))
