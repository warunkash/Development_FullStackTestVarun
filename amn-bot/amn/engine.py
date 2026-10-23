"""AMN state machine (PRD section 3), one instance per instrument.

All structural logic runs in "long space": for a short setup every price is
negated (and high/low swapped) so a single code path serves both directions.
Public levels in events/signals are converted back to real prices.
"""
from dataclasses import dataclass, field
from typing import Optional

from .config import Config

IDLE, BOS, TAP, SWEEP, PENDING, IN_TRADE, INVALIDATED = (
    "IDLE", "BOS_CONFIRMED", "SHALLOW_TAP_FORMED", "SWEEP_DETECTED",
    "LTF_CONFIRMATION_PENDING", "IN_TRADE", "INVALIDATED")


class Bar:
    __slots__ = ("ts", "o", "h", "l", "c")

    def __init__(self, ts, o, h, l, c):
        self.ts, self.o, self.h, self.l, self.c = ts, o, h, l, c

    def __repr__(self):
        return f"Bar({self.ts},{self.o:.5g},{self.h:.5g},{self.l:.5g},{self.c:.5g})"


def norm(b, d):
    """Bar as seen in long space."""
    return (b.o, b.h, b.l, b.c) if d == 1 else (-b.o, -b.l, -b.h, -b.c)


@dataclass
class Signal:
    symbol: str
    direction: int            # +1 long, -1 short
    ts: int
    entry: float
    sl: float
    tp1: float
    tp2: float
    trigger: str              # "CHoCH" | "ENGULFING"
    zone: tuple               # (low, high) real prices
    l_idm: float
    sweep_extreme: float


@dataclass
class Setup:
    d: int
    zone_lo: float            # long-space; zone_lo is the extreme (invalidation) edge
    zone_hi: float
    zone_idx: int
    bos_idx: int
    leg_high: float
    state: str = BOS
    age: int = 0
    pb_low: Optional[float] = None
    pb_idx: Optional[int] = None
    l_idm: Optional[float] = None
    h_tap: Optional[float] = None
    sweep_low: Optional[float] = None
    sweep_ltf_idx: int = 0
    pending_age: int = 0


class AMNEngine:
    def __init__(self, symbol, cfg: Config = None, on_event=None):
        self.symbol = symbol
        self.cfg = cfg or Config()
        self.on_event = on_event
        self.log = []                 # (ts, from, to, note, details) -- FR-3 telemetry
        self.htf = []                 # completed HTF bars
        self.ltf = []                 # recent LTF bars
        self._ltf_n = 0               # total LTF bars seen
        self.swing_highs = []         # (idx, price) confirmed
        self.swing_lows = []
        self._broken_sh = None
        self._broken_sl = None
        self.trend = 0
        self.setup: Optional[Setup] = None
        self.state = IDLE
        self.flags = []               # e.g. NO_INDUCEMENT markers (TC-02)
        self.now = 0

    # ---------------------------------------------------------------- utils
    def _emit(self, new_state, note="", **details):
        old = self.state
        self.state = new_state
        if self.setup is not None:
            self.setup.state = new_state
        rec = (self.now, old, new_state, note, details)
        self.log.append(rec)
        if self.on_event:
            self.on_event(self.symbol, *rec)

    def _atr(self):
        n = self.cfg.atr_n
        bars = self.htf[-(n + 1):]
        if len(bars) < 2:
            return bars[-1].h - bars[-1].l if bars else 0.0
        trs = [max(b.h - b.l, abs(b.h - p.c), abs(b.l - p.c))
               for p, b in zip(bars, bars[1:])]
        return sum(trs) / len(trs)

    # ------------------------------------------------------------ HTF logic
    def on_htf_bar(self, bar: Bar):
        self.now = bar.ts
        self.htf.append(bar)
        k = len(self.htf) - 1
        n = self.cfg.swing_n
        if k >= 2 * n:
            self._detect_swings(k - n)
        s = self.setup
        if s is not None:
            self._update_setup_htf(s, bar, k)
        self._detect_bos(bar, k)

    def _detect_swings(self, i):
        n, hb = self.cfg.swing_n, self.htf
        b = hb[i]
        if all(b.h > hb[j].h for j in range(i - n, i)) and \
           all(b.h > hb[j].h for j in range(i + 1, i + n + 1)):
            self.swing_highs.append((i, b.h))
        if all(b.l < hb[j].l for j in range(i - n, i)) and \
           all(b.l < hb[j].l for j in range(i + 1, i + n + 1)):
            self.swing_lows.append((i, b.l))

    def _detect_bos(self, bar, k):
        """Body-close rule: wick-only breaks are ignored (TC-01)."""
        for d, swings, broken_attr in ((1, self.swing_highs, "_broken_sh"),
                                       (-1, self.swing_lows, "_broken_sl")):
            if not swings:
                continue
            idx, px = swings[-1]
            if getattr(self, broken_attr) == idx:
                continue
            if (d == 1 and bar.c > px) or (d == -1 and bar.c < px):
                setattr(self, broken_attr, idx)
                self._on_bos(d, idx, px, k)

    def _on_bos(self, d, swing_idx, swing_px, k):
        cfg = self.cfg
        continuation = self.trend == d
        self.trend = d
        busy = self.setup is not None and self.setup.state in (SWEEP, PENDING, IN_TRADE)
        if busy:
            return
        if self.setup is not None and self.setup.d != d:
            self._kill(IDLE, "trend_flip")
        if cfg.require_continuation and not continuation:
            self._log_note("HTF_TREND_FLIP", dir=d)
            return
        if self.setup is not None and self.setup.d == d and self.setup.state == TAP:
            return                          # keep the mapped inducement
        # origin zone: extreme candle of the leg that produced the BOS
        opp = self.swing_lows if d == 1 else self.swing_highs
        start = next((i for i, _ in reversed(opp) if i < swing_idx), max(0, swing_idx - 2 * cfg.swing_n))
        seg = range(start, k + 1)
        if d == 1:
            zi = min(seg, key=lambda i: self.htf[i].l)
        else:
            zi = max(seg, key=lambda i: self.htf[i].h)
        zb = self.htf[zi]
        zlo, zhi, _, _ = (zb.l, zb.h, 0, 0) if d == 1 else (-zb.h, -zb.l, 0, 0)
        leg_high = max(norm(self.htf[i], d)[1] for i in range(zi, k + 1))
        self.setup = Setup(d, zlo, zhi, zi, k, leg_high)
        self._emit(BOS, "BOS", dir=d, zone=(min(zb.l, zb.h), max(zb.l, zb.h)),
                   broken=swing_px, tf="HTF")

    def _log_note(self, note, **kw):
        self.log.append((self.now, self.state, self.state, note, kw))
        if self.on_event:
            self.on_event(self.symbol, self.now, self.state, self.state, note, kw)

    def _kill(self, state, note, **kw):
        self._emit(state, note, **kw)
        self.setup = None
        if state == INVALIDATED:
            self.state = IDLE            # terminal for the setup, engine free again
            self.log.append((self.now, INVALIDATED, IDLE, "reset", {}))

    def _update_setup_htf(self, s: Setup, bar: Bar, k: int):
        cfg, d = self.cfg, s.d
        o, h, l, c = norm(bar, d)
        s.age += 1
        s.leg_high = max(s.leg_high, h)
        if s.state == IN_TRADE:
            return
        if s.age > cfg.max_setup_age_htf:
            self._kill(IDLE, "expired")
            return
        if s.state == BOS:
            # (1) tap completes on the bar *after* a pro-trend run
            if self._try_form_tap(s, bar, k, (o, h, l, c)):
                return
            # (2) direct hit of the origin without inducement -> no trade (TC-02)
            if l <= s.zone_hi:
                self.flags.append((bar.ts, "NO_INDUCEMENT"))
                self._kill(IDLE, "NO_INDUCEMENT")
                return
            # track the pullback low / bounce run
            if s.pb_low is None or l < s.pb_low:
                s.pb_low, s.pb_idx = l, k
        elif s.state in (TAP, PENDING, SWEEP):
            if c < s.zone_lo:               # body closed through the extreme
                self._kill(INVALIDATED, "body_close_beyond_extreme", close=bar.c)

    def _bounce_run(self, s, k):
        """Consecutive pro-trend candles ending at HTF bar k, all after the pullback low."""
        run = 0
        for i in range(k, s.pb_idx, -1):
            o, h, l, c = norm(self.htf[i], s.d)
            if c > o:
                run += 1
            else:
                break
        return run

    def _try_form_tap(self, s, bar, k, nb):
        cfg = self.cfg
        if s.pb_idx is None or k - 1 <= s.pb_idx:
            return False
        if self._bounce_run(s, k - 1) < cfg.min_bounce_bars:
            return False
        o, h, l, c = nb
        if c > o:                           # run still extending; tap forms when it stops
            return False
        atr = self._atr()
        if s.pb_low - s.zone_hi < cfg.tap_atr_mult * atr:
            return False                    # not shallow enough: too close to the zone
        s.l_idm = s.pb_low
        s.h_tap = max(norm(self.htf[i], s.d)[1] for i in range(s.pb_idx, k))
        self._emit(TAP, "INDUCEMENT", dir=s.d, l_idm=s.l_idm * s.d, h_tap=s.h_tap * s.d,
                   zone=self._zone_real(s))
        # the bar that confirmed the tap may already have swept it
        if l < s.l_idm and l <= s.zone_hi:
            s.sweep_low = l
            s.sweep_ltf_idx = self._ltf_n
            self._emit(SWEEP, "SWEEP", sweep=l * s.d)
            self._emit(PENDING, "LTF_PENDING")
        return True

    def _zone_real(self, s):
        a, b = s.zone_lo * s.d, s.zone_hi * s.d
        return (min(a, b), max(a, b))

    # ------------------------------------------------------------ LTF logic
    def on_ltf_bar(self, bar: Bar) -> Optional[Signal]:
        self.now = bar.ts
        self.ltf.append(bar)
        if len(self.ltf) > 400:
            del self.ltf[:100]
        self._ltf_n += 1
        s = self.setup
        if s is None or s.state not in (TAP, PENDING):
            return None
        o, h, l, c = norm(bar, s.d)
        if s.state == TAP:
            if l < s.l_idm and l <= s.zone_hi:
                s.sweep_low = l
                s.sweep_ltf_idx = self._ltf_n
                self._emit(SWEEP, "SWEEP", sweep=l * s.d)
                self._emit(PENDING, "LTF_PENDING")
            else:
                return None
        else:
            s.sweep_low = min(s.sweep_low, l)
        s.pending_age += 1
        if s.pending_age > self.cfg.ltf_timeout:
            self._kill(IDLE, "sweep_timeout")
            return None
        trig = self._ltf_trigger(s, (o, h, l, c))
        if not trig:
            return None
        atr = self._atr()
        sl = s.sweep_low - self.cfg.sl_atr_buffer * atr
        entry = c
        risk = entry - sl
        if risk <= 0 or s.h_tap <= entry:
            return None
        rr2 = (s.leg_high - entry) / risk
        if rr2 < self.cfg.min_rr:
            self._log_note("rr_too_low", rr=rr2)
            return None
        d = s.d
        return Signal(self.symbol, d, bar.ts, entry * d, sl * d, s.h_tap * d,
                      s.leg_high * d, trig, self._zone_real(s), s.l_idm * d,
                      s.sweep_low * d)

    def _micro_swing_high(self, s):
        n = self.cfg.ltf_swing_n
        bars = self.ltf
        m = len(bars)
        first_ok = s.sweep_ltf_idx - 5       # swing must belong to the sweep leg
        for i in range(m - 1 - n, max(n, m - 80), -1):
            gi = self._ltf_n - m + i + 1      # 1-based global index of bars[i]
            if gi < first_ok:
                break
            hi = norm(bars[i], s.d)[1]
            if all(hi > norm(bars[j], s.d)[1] for j in range(i - n, i)) and \
               all(hi > norm(bars[j], s.d)[1] for j in range(i + 1, i + n + 1)):
                return hi
        return None

    def _ltf_trigger(self, s, nb):
        cfg = self.cfg
        o, h, l, c = nb
        mh = self._micro_swing_high(s)
        if mh is not None and c > mh:
            return "CHoCH"
        rng = h - l
        if rng > 0 and c > o:
            prev = self.ltf[-(cfg.avg_body_n + 1):-1]
            if len(prev) >= 3:
                avg = sum(abs(p.c - p.o) for p in prev) / len(prev)
                if avg > 0 and (c - o) > cfg.body_mult * avg and (min(o, c) - l) >= cfg.wick_frac * rng:
                    return "ENGULFING"
        return None

    # --------------------------------------------------- lifecycle callbacks
    def on_order_filled(self):
        if self.setup:
            self.setup.state = IN_TRADE
        self._emit(IN_TRADE, "TRADE_EXECUTED")

    def on_trade_closed(self):
        self.setup = None
        self._emit(IDLE, "TRADE_CLOSED")
