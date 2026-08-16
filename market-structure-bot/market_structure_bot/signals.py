"""Break-of-Structure and Change-of-Character detection.

Two things can happen when price takes out a swing point:

* **BOS** (Break of Structure) -- the break goes *with* the prevailing trend.
  An uptrend taking out its last swing high is a continuation.
* **CHoCH** (Change of Character) -- the break goes *against* it. A downtrend
  taking out its last swing high is the first evidence the sellers lost
  control, and it flips the bot's trend state.

Everything here runs as a **replay**: candles are walked one at a time and a
pivot only enters the picture at its ``confirm_index``, i.e. ``depth`` bars
after it printed. That is the same information a live bot would have had at
that moment, so a backfilled signal list is not inflated by hindsight. The
cost is real and worth stating plainly: a signal is confirmed ``depth`` bars
late, and on a 5m chart with ``depth=3`` that is 15 minutes of lag.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from .candles import Candle
from .market_hours import IST
from .structure import (
    DOWNTREND,
    HIGH,
    LOW,
    RANGE,
    UPTREND,
    Pivot,
    Structure,
    admit_pivot,
    find_raw_pivots,
    label_pivots,
    trend_from_labels,
)

BOS = "BOS"
CHOCH = "CHoCH"
BULLISH = "bullish"
BEARISH = "bearish"


@dataclass(frozen=True)
class Signal:
    """A confirmed break of a swing level."""

    kind: str               #: BOS or CHoCH
    direction: str          #: bullish or bearish
    index: int              #: candle index of the breaking bar
    epoch: int              #: open time of the breaking bar (UTC seconds)
    price: float            #: close of the breaking bar
    level: float            #: the swing price that was broken
    level_label: str        #: label of the broken swing (HH, LH, ...)
    trend_before: str
    trend_after: str
    stop: float | None      #: opposing swing -- where the idea is wrong
    target: float | None    #: ``reward_multiple`` x risk beyond entry

    @property
    def time_ist(self) -> datetime:
        return datetime.fromtimestamp(self.epoch, tz=IST)

    @property
    def risk_pct(self) -> float | None:
        if self.stop is None or not self.price:
            return None
        return abs(self.price - self.stop) / self.price * 100.0

    def describe(self) -> str:
        arrow = "^" if self.direction == BULLISH else "v"
        return (
            f"{arrow} {self.kind} {self.direction} @ {self.price:.2f} "
            f"(broke {self.level_label} {self.level:.2f}, "
            f"{self.trend_before} -> {self.trend_after})"
        )


@dataclass(frozen=True)
class Analysis:
    """Everything the bot knows about one symbol after a replay."""

    symbol: str
    interval: str
    candles: list[Candle]
    structure: Structure
    signals: list[Signal]
    trend: str  #: trend state carried by the last break, not just the labels

    @property
    def last_signal(self) -> Signal | None:
        return self.signals[-1] if self.signals else None

    @property
    def last_price(self) -> float | None:
        return self.candles[-1].close if self.candles else None

    def bars_since_last_signal(self) -> int | None:
        if not self.signals or not self.candles:
            return None
        return (len(self.candles) - 1) - self.signals[-1].index


def _projected_target(
    entry: float, stop: float | None, direction: str, reward_multiple: float
) -> float | None:
    if stop is None:
        return None
    risk = abs(entry - stop)
    if risk <= 0:
        return None
    return entry + reward_multiple * risk if direction == BULLISH else entry - reward_multiple * risk


def replay(
    candles: list[Candle],
    symbol: str = "",
    interval: str = "5m",
    depth: int = 3,
    min_swing_pct: float = 0.0,
    reward_multiple: float = 2.0,
    use_wicks: bool = False,
) -> Analysis:
    """Walk the candles forward, building structure and emitting breaks.

    ``use_wicks=False`` (the default) requires a *close* beyond the swing
    level. Wick-based breaks fire earlier but count every stop-hunt as a
    signal; set ``use_wicks=True`` if that is what you want.
    """
    raw = find_raw_pivots(candles, depth)
    by_confirm: dict[int, list[Pivot]] = {}
    for pivot in raw:
        by_confirm.setdefault(pivot.confirm_index, []).append(pivot)

    kept: list[Pivot] = []
    signals: list[Signal] = []
    trend = RANGE
    # Swing indices already traded through, so one level fires at most once.
    consumed_high: int | None = None
    consumed_low: int | None = None

    for i, candle in enumerate(candles):
        for pivot in by_confirm.get(i, []):
            before = kept[-1] if kept else None
            kept = admit_pivot(kept, pivot, min_swing_pct)
            after = kept[-1] if kept else None
            if after is not before:
                # A fresh (or extended) swing is a new, unbroken reference.
                if after is not None and after.kind == HIGH:
                    consumed_high = None
                elif after is not None and after.kind == LOW:
                    consumed_low = None

        labeled = label_pivots(kept)
        last_high = next((p for p in reversed(labeled) if p.kind == HIGH), None)
        last_low = next((p for p in reversed(labeled) if p.kind == LOW), None)

        up_level = candle.high if use_wicks else candle.close
        down_level = candle.low if use_wicks else candle.close

        broke_high = (
            last_high is not None
            and last_high.index != consumed_high
            and up_level > last_high.price
        )
        broke_low = (
            last_low is not None
            and last_low.index != consumed_low
            and down_level < last_low.price
        )

        # A bar that takes out both sides is an outside bar; nothing about the
        # order of the two touches is knowable from OHLC, so skip it rather
        # than invent a sequence.
        if broke_high and broke_low:
            continue

        if broke_high:
            effective = trend if trend != RANGE else trend_from_labels(labeled)
            kind = CHOCH if effective == DOWNTREND else BOS
            stop = last_low.price if last_low else None
            signals.append(
                Signal(
                    kind=kind, direction=BULLISH, index=i, epoch=candle.epoch,
                    price=candle.close, level=last_high.price,
                    level_label=last_high.label, trend_before=effective,
                    trend_after=UPTREND, stop=stop,
                    target=_projected_target(candle.close, stop, BULLISH, reward_multiple),
                )
            )
            trend = UPTREND
            consumed_high = last_high.index

        elif broke_low:
            effective = trend if trend != RANGE else trend_from_labels(labeled)
            kind = CHOCH if effective == UPTREND else BOS
            stop = last_high.price if last_high else None
            signals.append(
                Signal(
                    kind=kind, direction=BEARISH, index=i, epoch=candle.epoch,
                    price=candle.close, level=last_low.price,
                    level_label=last_low.label, trend_before=effective,
                    trend_after=DOWNTREND, stop=stop,
                    target=_projected_target(candle.close, stop, BEARISH, reward_multiple),
                )
            )
            trend = DOWNTREND
            consumed_low = last_low.index

    final = label_pivots(kept)
    structure = Structure(pivots=final, trend=trend_from_labels(final))
    return Analysis(
        symbol=symbol,
        interval=interval,
        candles=candles,
        structure=structure,
        signals=signals,
        trend=trend if trend != RANGE else structure.trend,
    )
