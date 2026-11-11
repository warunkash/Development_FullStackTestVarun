"""Verification matrix TC-01..TC-05 (PRD section 7) plus supporting checks."""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from amn.alerts import Notifier
from amn.config import Config, INSTRUMENTS
from amn.engine import AMNEngine, Bar, BOS, IDLE, IN_TRADE, PENDING, TAP
from amn.execution import Broker, NewsFilter, Trader, position_size
from amn.store import Store

BASE = int(datetime(2026, 10, 20, 8, 0, tzinfo=timezone.utc).timestamp())
CFG = Config(require_continuation=False, min_rr=1.0)
SYM = "EURUSD"


def px(x, mirror=False):
    p = 1.0 + (x - 10) * 0.001
    return 2.0 - p if mirror else p


def mkbar(ts, o, h, l, c, mirror=False):
    if mirror:
        return Bar(ts, px(o, True), px(l, True), px(h, True), px(c, True))
    return Bar(ts, px(o), px(h), px(l), px(c))


# (o, h, l, c) in "abstract" price units
HTF_PRE = [
    (10.1, 10.4, 9.9, 10.2), (10.2, 10.3, 9.8, 10.0), (10.0, 10.1, 9.6, 9.9),
    (9.6, 9.7, 9.0, 9.3),            # 3: origin extreme candle / swing low
    (9.3, 10.0, 9.4 - 0.0, 9.9), (9.9, 10.3, 9.5, 10.2), (10.2, 10.6, 9.7, 10.5),
    (10.5, 11.0, 10.3, 10.8),        # 7: swing high 11.0
    (10.8, 10.8, 10.1, 10.5), (10.5, 10.6, 9.9, 10.3), (10.3, 10.5, 9.8, 10.2),
]
WICK_ONLY = (10.2, 11.3, 10.1, 10.9)       # pierces 11.0 but closes below
BOS_BAR = (10.9, 11.9, 10.8, 11.7)          # body close above 11.0
TAP_RUN = [                                  # pullback + shallow tap (low 10.4, zone top 9.7)
    (11.7, 11.8, 11.2, 11.3), (11.3, 11.4, 10.8, 10.9), (10.9, 10.95, 10.4, 10.5),
    (10.5, 10.9, 10.45, 10.8), (10.8, 11.2, 10.7, 11.1),
    (11.1, 11.15, 10.8, 10.9),               # first non-bullish bar -> tap confirmed
]
LTF_SWEEP = [                                # falls through L_IDM 10.4, touches zone, bounces
    (10.85, 10.9, 10.6, 10.7), (10.7, 10.75, 10.3, 10.35), (10.35, 10.4, 9.9, 9.95),
    (9.95, 10.0, 9.55, 9.7),                 # sweep bar (low 9.55 <= zone top 9.7)
    (9.7, 9.9, 9.6, 9.75), (9.75, 10.1, 9.7, 10.0), (10.0, 9.95, 9.8, 9.85),
    (9.85, 9.9, 9.75, 9.8),
]
LTF_CHOCH = (9.8, 10.25, 9.78, 10.2)        # closes above micro swing high 10.1


def feed_htf(eng, rows, start=None, mirror=False):
    start = start if start is not None else BASE - 40 * 900
    for i, r in enumerate(rows):
        eng.on_htf_bar(mkbar(start + i * 900, *r, mirror=mirror))
    return start + len(rows) * 900


def feed_ltf(eng, rows, mirror=False, t0=BASE):
    sig = None
    for i, r in enumerate(rows):
        s = eng.on_ltf_bar(mkbar(t0 + i * 60, *r, mirror=mirror))
        sig = sig or s
    return sig, t0 + len(rows) * 60


class StubBroker(Broker):
    def spread(self, symbol, ts): return INSTRUMENTS[symbol].typical_spread
    def market_order(self, symbol, d, lots, ref, ts):
        return ref + d * INSTRUMENTS[symbol].typical_spread / 2, INSTRUMENTS[symbol].typical_spread, 0.0
    def close(self, symbol, d, lots, price, ts): return price


def test_tc01_wick_only_break_is_not_bos():
    e = AMNEngine(SYM, CFG)
    feed_htf(e, HTF_PRE + [WICK_ONLY])
    assert e.setup is None and e.state == IDLE
    assert not any(l[3] == "BOS" for l in e.log)


def test_tc01b_body_close_is_bos():
    e = AMNEngine(SYM, CFG)
    feed_htf(e, HTF_PRE + [WICK_ONLY, BOS_BAR])
    assert e.state == BOS
    assert abs(e.setup.zone_lo - px(9.0)) < 1e-9 and abs(e.setup.zone_hi - px(9.7)) < 1e-9


def test_tc02_direct_zone_hit_without_tap_blocks_trade():
    e = AMNEngine(SYM, CFG)
    feed_htf(e, HTF_PRE + [BOS_BAR, (11.7, 11.75, 10.9, 11.0), (11.0, 11.05, 9.6, 9.9)])
    assert (e.log[-1][3]) == "NO_INDUCEMENT" and e.state == IDLE
    sig, _ = feed_ltf(e, LTF_SWEEP + [LTF_CHOCH])
    assert sig is None


def build_tap(mirror=False):
    e = AMNEngine(SYM, CFG)
    feed_htf(e, HTF_PRE + [BOS_BAR] + TAP_RUN, mirror=mirror)
    return e


def test_tap_detected_and_levels_stored():
    e = build_tap()
    assert e.state == TAP
    assert abs(e.setup.l_idm - px(10.4)) < 1e-9
    assert abs(e.setup.h_tap - px(11.2)) < 1e-9


def test_tc03_body_close_below_origin_invalidates():
    e = build_tap()
    feed_ltf(e, LTF_SWEEP)
    assert e.state == PENDING
    e.on_htf_bar(mkbar(BASE, 9.7, 9.8, 8.7, 8.9))        # closes below zone low 9.0
    assert any(l[2] == "INVALIDATED" for l in e.log)
    sig, _ = feed_ltf(e, [LTF_CHOCH], t0=BASE + 600)
    assert sig is None and (e.setup is None or e.setup.d == -1)   # long setup is dead


def test_tc04_sweep_choch_fires_long_with_sl_at_sweep_low_and_correct_size():
    e = build_tap()
    sig, _ = feed_ltf(e, LTF_SWEEP + [LTF_CHOCH])
    assert sig and sig.direction == 1 and sig.trigger == "CHoCH"
    atr = e._atr()
    assert abs(sig.sl - (px(9.55) - 0.5 * atr)) < 1e-9
    assert sig.tp1 == px(11.2) and sig.tp2 > sig.tp1
    cfg = Config()
    tr = Trader(cfg, StubBroker(), NewsFilter([], 15))
    pos = tr.try_enter(sig, {})
    assert pos is not None
    expect = int(cfg.balance * 0.01 / (abs(sig.entry - sig.sl) * 100_000) * 100) / 100
    assert abs(pos.lots - expect) < 1e-9 and pos.lots > 0
    e.on_order_filled()
    assert e.state == IN_TRADE
    # risk actually taken ~= 1% (fill adds half a spread)
    assert 0.95 * 100 <= pos.risk_ccy <= 1.05 * 100


def test_short_mirror_symmetry():
    e = build_tap(mirror=True)
    assert e.state == TAP and e.setup.d == -1
    sig, _ = feed_ltf(e, LTF_SWEEP + [LTF_CHOCH], mirror=True)
    assert sig and sig.direction == -1
    assert sig.sl > sig.entry > sig.tp1 > sig.tp2 or sig.sl > sig.entry > sig.tp1


def test_tc05_news_blocks_complete_setup():
    e = build_tap()
    sig, _ = feed_ltf(e, LTF_SWEEP + [LTF_CHOCH])
    assert sig
    news = NewsFilter([sig.ts + 600], 15)                # CPI in 10 minutes
    assert news.active(sig.ts)
    tr = Trader(Config(), StubBroker(), news)
    assert tr.try_enter(sig, {}) is None
    assert tr.rejects.get("news_ACTIVE_RESTRICTION") == 1 and not tr.positions


def test_spread_and_session_and_max_positions_filters():
    e = build_tap()
    sig, _ = feed_ltf(e, LTF_SWEEP + [LTF_CHOCH])
    class Wide(StubBroker):
        def spread(self, s, ts): return 1.0
    assert Trader(Config(), Wide(), NewsFilter([])).try_enter(sig, {}) is None
    late = type(sig)(**{**sig.__dict__, "ts": BASE + 6 * 3600})   # 14:00 -> NY window ok; 20:00 not
    off = type(sig)(**{**sig.__dict__, "ts": BASE + 12 * 3600})
    assert Trader(Config(), StubBroker(), NewsFilter([])).try_enter(off, {}) is None
    t = Trader(Config(max_positions=1), StubBroker(), NewsFilter([]))
    assert t.try_enter(sig, {})
    other = type(sig)(**{**sig.__dict__, "symbol": "GBPUSD"})
    assert t.try_enter(other, {}) is None and t.rejects["max_positions"] == 1


def test_bracket_tp1_partial_then_breakeven():
    e = build_tap()
    sig, _ = feed_ltf(e, LTF_SWEEP + [LTF_CHOCH])
    t = Trader(Config(), StubBroker(), NewsFilter([]))
    pos = t.try_enter(sig, {})
    t.on_bar(SYM, Bar(sig.ts + 60, sig.entry, sig.tp1 + 1e-4, sig.entry, sig.tp1), None)
    assert pos.tp1_hit and abs(pos.lots_open - pos.lots * 0.5) < 0.011 and pos.sl == pos.entry
    t.on_bar(SYM, Bar(sig.ts + 120, sig.entry, sig.entry, pos.entry - 1e-4, pos.entry), None)
    assert pos.exit_reason == "BE" and SYM not in t.positions


def test_daily_drawdown_kills_and_disables_24h():
    e = build_tap()
    sig, _ = feed_ltf(e, LTF_SWEEP + [LTF_CHOCH])
    t = Trader(Config(risk_pct=5.0), StubBroker(), NewsFilter([]))
    t.on_tick_equity(sig.ts, {})
    pos = t.try_enter(sig, {})
    t.on_tick_equity(sig.ts + 60, {SYM: sig.sl - 1e-4})
    assert not t.positions and t.dd_kills == 1
    sig2 = type(sig)(**{**sig.__dict__, "ts": sig.ts + 3600})
    assert t.try_enter(sig2, {}) is None and t.rejects.get("bot_disabled_dd") == 1


def test_sqlite_recovery_roundtrip():
    e = build_tap()
    sig, _ = feed_ltf(e, LTF_SWEEP + [LTF_CHOCH])
    t = Trader(Config(), StubBroker(), NewsFilter([]))
    pos = t.try_enter(sig, {})
    s = Store()
    s.save_position(pos)
    s.save_setup(SYM, e.setup)
    back = s.load_positions()[SYM]
    assert back.lots == pos.lots and back.sl == pos.sl
    assert s.load_setups()[SYM].l_idm == e.setup.l_idm


def test_alerts_fire_on_bos_inducement_sweep():
    n = Notifier(sender=lambda m: None)
    e = AMNEngine(SYM, CFG, on_event=n.engine_hook)
    feed_htf(e, HTF_PRE + [BOS_BAR] + TAP_RUN)
    feed_ltf(e, LTF_SWEEP)
    kinds = [k for k, _ in n.sent]
    assert kinds == ["BOS", "INDUCEMENT", "SWEEP"]


def test_position_sizing_formula():
    spec = INSTRUMENTS["XAUUSD"]
    assert position_size(Config(), spec, 10_000, 2400.0, 2395.0) == 0.2   # 100/(5*100)
