"""Risk & execution controller (PRD sections 4-5): sizing, filters, bracket
management (50% at TP1 -> SL to breakeven, remainder to TP2), daily DD kill.

The broker is an interface; `SimBroker` models spread + slippage for
backtests/paper. A live adapter (MT5 / cTrader / Tradovate) implements the same
three methods.
"""
import math
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from .config import Config, INSTRUMENTS


class Broker:
    def spread(self, symbol, ts) -> float: raise NotImplementedError
    def market_order(self, symbol, direction, lots, ref_price, ts): raise NotImplementedError
    def close(self, symbol, direction, lots, price, ts): raise NotImplementedError


class SimBroker(Broker):
    """Mid-price feed + synthetic spread. Spread widens at rollover (21-23 UTC)
    and spikes randomly (3x on ~1% of minutes) so the spread filter is exercised."""

    def __init__(self, seed=7, spike_prob=0.01):
        self.rng = random.Random(seed)
        self.spike_prob = spike_prob

    def spread(self, symbol, ts):
        spec = INSTRUMENTS[symbol]
        hour = (ts // 3600) % 24
        s = spec.typical_spread * (self.rng.uniform(0.8, 1.2))
        if 21 <= hour < 23:
            s *= 4
        if self.rng.random() < self.spike_prob:
            s *= 3
        return s

    def market_order(self, symbol, direction, lots, ref_price, ts):
        spec = INSTRUMENTS[symbol]
        sp = self.spread(symbol, ts)
        slip = self.rng.expovariate(1 / (0.15 * spec.pip))
        if self.rng.random() < 0.02:          # rare gap/fast-market fill
            slip *= 8
        # buy at ask (+half spread), sell at bid; slippage always adverse
        return ref_price + direction * (sp / 2 + slip), sp, slip

    def close(self, symbol, direction, lots, price, ts):
        # exits cross half the typical spread
        return price - direction * INSTRUMENTS[symbol].typical_spread / 2


@dataclass
class Position:
    symbol: str
    d: int
    lots: float
    entry: float          # fill price
    sl: float
    tp1: float
    tp2: float
    open_ts: int
    risk_ccy: float       # $ at risk at entry (1R)
    ref_entry: float = 0.0
    lots_open: float = 0.0
    tp1_hit: bool = False
    pnl: float = 0.0      # realised, account ccy
    close_ts: Optional[int] = None
    exit_reason: str = ""
    trigger: str = ""
    sl0: float = 0.0      # initial stop (sl moves to breakeven after TP1)

    def __post_init__(self):
        self.lots_open = self.lots
        self.sl0 = self.sl


def round_lots(spec, lots):
    lots = math.floor(lots / spec.lot_step + 1e-9) * spec.lot_step
    return round(min(lots, spec.max_lot), 8)


def position_size(cfg: Config, spec, balance, entry, sl):
    """L = balance * risk% / (|entry - SL| * value per unit)."""
    dist = abs(entry - sl)
    if dist <= 0:
        return 0.0
    return round_lots(spec, balance * cfg.risk_pct / 100 / (dist * spec.value_per_unit))


class NewsFilter:
    """Blocks entries within +/- window minutes of high-impact events."""

    def __init__(self, event_ts, window_min=15):
        self.events = sorted(event_ts)
        self.w = window_min * 60

    def active(self, ts):
        import bisect
        i = bisect.bisect_left(self.events, ts - self.w)
        return i < len(self.events) and self.events[i] <= ts + self.w


def in_session(cfg: Config, ts):
    h = (ts // 3600) % 24
    return any(a <= h < b for a, b in cfg.sessions)


class Trader:
    def __init__(self, cfg: Config, broker: Broker, news: NewsFilter, notifier=None):
        self.cfg, self.broker, self.news, self.notify = cfg, broker, news, notifier
        self.balance = cfg.balance
        self.positions = {}          # symbol -> Position
        self.closed = []
        self.rejects = {}            # reason -> count
        self.day = None
        self.day_start_balance = cfg.balance
        self.disabled_until = 0
        self.dd_kills = 0
        self.equity_curve = []       # (ts, equity)

    # ------------------------------------------------------------ entries
    def _reject(self, why):
        self.rejects[why] = self.rejects.get(why, 0) + 1
        return None

    def try_enter(self, sig, last_prices):
        cfg, ts = self.cfg, sig.ts
        spec = INSTRUMENTS[sig.symbol]
        if ts < self.disabled_until:
            return self._reject("bot_disabled_dd")
        if sig.symbol in self.positions:
            return self._reject("already_in_symbol")
        if len(self.positions) >= cfg.max_positions:
            return self._reject("max_positions")
        if self.news.active(ts):
            return self._reject("news_ACTIVE_RESTRICTION")
        if not in_session(cfg, ts):
            return self._reject("outside_session")
        if self.broker.spread(sig.symbol, ts) > spec.max_spread:
            return self._reject("spread_too_wide")
        lots = position_size(cfg, spec, self.balance, sig.entry, sig.sl)
        if lots < spec.min_lot:
            return self._reject("lot_below_min")
        fill, sp, slip = self.broker.market_order(sig.symbol, sig.direction, lots, sig.entry, ts)
        if slip > cfg.max_slippage_pips * spec.pip:
            return self._reject("slippage_exceeded")
        # SL stays at the structural level; real risk includes the adverse fill
        risk_ccy = abs(fill - sig.sl) * spec.value_per_unit * lots
        pos = Position(sig.symbol, sig.direction, lots, fill, sig.sl, sig.tp1, sig.tp2,
                       ts, risk_ccy, ref_entry=sig.entry, trigger=sig.trigger)
        self.positions[sig.symbol] = pos
        if self.notify:
            self.notify("TRADE_EXECUTED", f"{sig.symbol} {'BUY' if sig.direction>0 else 'SELL'} "
                        f"{lots} @ {fill:.5g} SL {sig.sl:.5g} TP1 {sig.tp1:.5g} TP2 {sig.tp2:.5g}")
        return pos

    # --------------------------------------------------------- management
    def _realise(self, pos, lots, price, ts):
        spec = INSTRUMENTS[pos.symbol]
        px = self.broker.close(pos.symbol, pos.d, lots, price, ts)
        pnl = (px - pos.entry) * pos.d * spec.value_per_unit * lots
        pos.pnl += pnl
        pos.lots_open -= lots
        self.balance += pnl

    def _finish(self, pos, ts, reason):
        pos.close_ts, pos.exit_reason = ts, reason
        del self.positions[pos.symbol]
        self.closed.append(pos)

    def on_bar(self, symbol, bar, engine_cb=None):
        pos = self.positions.get(symbol)
        if not pos or bar.ts <= pos.open_ts:
            return
        d = pos.d
        hi, lo = (bar.h, bar.l) if d == 1 else (-bar.l, -bar.h)
        sl, tp1, tp2 = pos.sl * d, pos.tp1 * d, pos.tp2 * d
        # pessimistic intrabar order: stop first
        if lo <= sl:
            self._realise(pos, pos.lots_open, pos.sl, bar.ts)
            self._finish(pos, bar.ts, "BE" if pos.tp1_hit else "SL")
            if engine_cb: engine_cb(symbol)
            return
        if not pos.tp1_hit and hi >= tp1:
            self._realise(pos, pos.lots * self.cfg.tp1_fraction, pos.tp1, bar.ts)
            pos.tp1_hit = True
            pos.sl = pos.entry                      # move stop to breakeven
        if pos.tp1_hit and hi >= tp2:
            self._realise(pos, pos.lots_open, pos.tp2, bar.ts)
            self._finish(pos, bar.ts, "TP2")
            if engine_cb: engine_cb(symbol)

    def close_all(self, last_prices, ts, reason, engine_cb=None):
        for sym in list(self.positions):
            pos = self.positions[sym]
            self._realise(pos, pos.lots_open, last_prices[sym], ts)
            self._finish(pos, ts, reason)
            if engine_cb: engine_cb(sym)

    # ---------------------------------------------------------- DD / equity
    def floating(self, last_prices):
        tot = 0.0
        for p in self.positions.values():
            spec = INSTRUMENTS[p.symbol]
            tot += (last_prices[p.symbol] - p.entry) * p.d * spec.value_per_unit * p.lots_open
        return tot

    def on_tick_equity(self, ts, last_prices, engine_cb=None):
        day = ts // 86400
        if day != self.day:
            self.day, self.day_start_balance = day, self.balance + self.floating(last_prices)
        eq = self.balance + self.floating(last_prices)
        if eq <= self.day_start_balance * (1 - self.cfg.daily_dd_pct / 100) and ts >= self.disabled_until:
            self.close_all(last_prices, ts, "DAILY_DD_KILL", engine_cb)
            self.disabled_until = ts + 86400
            self.dd_kills += 1
            eq = self.balance
            if self.notify:
                self.notify("DAILY_DD", f"3% daily drawdown hit; bot disabled 24h")
        if ts % 900 == 0:
            self.equity_curve.append((ts, eq))
