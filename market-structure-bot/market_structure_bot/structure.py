"""Swing detection and market-structure labeling (High/Low, HH, HL, LH, LL).

The pipeline mirrors what a market-structure indicator draws on a chart:

1. **Fractal pivots** -- a bar is a swing high if its high is the highest in a
   window of ``depth`` bars either side (swing low: lowest). A pivot is only
   *confirmed* ``depth`` bars after it prints, because until then a later bar
   could still exceed it.
2. **Alternation** -- structure alternates high, low, high, low. Two swing
   highs in a row collapse to the higher one; two lows collapse to the lower.
3. **Noise filter** -- an optional ``min_swing_pct`` drops legs too small to
   count as structure, which matters on a 5m chart where raw fractals fire
   constantly.
4. **Labels** -- each swing is compared with the previous swing *of the same
   kind*: a higher high is ``HH``, a lower high ``LH``, a higher low ``HL``, a
   lower low ``LL``. The very first swing of each kind has nothing to compare
   against and is labeled ``High`` / ``Low``.

Trend then falls out of the last two labels: HH + HL is an uptrend, LH + LL a
downtrend, anything mixed is a range.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime

from .candles import Candle
from .market_hours import IST

HIGH = "high"
LOW = "low"

UPTREND = "uptrend"
DOWNTREND = "downtrend"
RANGE = "range"


@dataclass(frozen=True)
class Pivot:
    """One confirmed swing point."""

    index: int          #: index into the candle list where the swing printed
    epoch: int          #: open time of that candle (UTC seconds)
    price: float        #: the swing high's high, or the swing low's low
    kind: str           #: HIGH or LOW
    confirm_index: int  #: first candle index at which this pivot was knowable
    label: str = ""     #: High / Low / HH / HL / LH / LL

    @property
    def time_ist(self) -> datetime:
        return datetime.fromtimestamp(self.epoch, tz=IST)


@dataclass(frozen=True)
class Structure:
    """Structure as of some point in time."""

    pivots: list[Pivot]
    trend: str

    @property
    def last_high(self) -> Pivot | None:
        return next((p for p in reversed(self.pivots) if p.kind == HIGH), None)

    @property
    def last_low(self) -> Pivot | None:
        return next((p for p in reversed(self.pivots) if p.kind == LOW), None)

    @property
    def last_pivot(self) -> Pivot | None:
        return self.pivots[-1] if self.pivots else None


def find_raw_pivots(candles: list[Candle], depth: int = 3) -> list[Pivot]:
    """Find fractal swing highs/lows using a ``depth``-bar window either side.

    Ties are resolved in favour of the earlier bar (a flat top confirms at its
    first touch), and the last ``depth`` bars are never pivots because their
    right-hand window has not printed yet.
    """
    if depth < 1:
        raise ValueError("depth must be >= 1")

    pivots: list[Pivot] = []
    for i in range(depth, len(candles) - depth):
        window = candles[i - depth : i + depth + 1]
        bar = candles[i]
        left, right = window[:depth], window[depth + 1 :]

        if all(bar.high > c.high for c in left) and all(bar.high >= c.high for c in right):
            pivots.append(Pivot(i, bar.epoch, bar.high, HIGH, i + depth))
        elif all(bar.low < c.low for c in left) and all(bar.low <= c.low for c in right):
            pivots.append(Pivot(i, bar.epoch, bar.low, LOW, i + depth))
    return pivots


def admit_pivot(kept: list[Pivot], pivot: Pivot, min_swing_pct: float) -> list[Pivot]:
    """Add ``pivot`` to ``kept``, keeping the sequence alternating high/low.

    Returns a new list. Same-kind runs collapse to the extreme; an opposite-kind
    pivot that has not travelled ``min_swing_pct`` from the previous swing is
    treated as noise and dropped.
    """
    if not kept:
        return [pivot]

    last = kept[-1]
    if pivot.kind == last.kind:
        extends = pivot.price > last.price if pivot.kind == HIGH else pivot.price < last.price
        if extends:
            return kept[:-1] + [pivot]
        return kept

    if min_swing_pct > 0 and last.price:
        move_pct = abs(pivot.price - last.price) / last.price * 100.0
        if move_pct < min_swing_pct:
            return kept
    return kept + [pivot]


def label_pivots(pivots: list[Pivot]) -> list[Pivot]:
    """Attach High/Low/HH/HL/LH/LL labels to an alternating pivot sequence.

    An exactly equal high counts as ``LH`` (and an equal low as ``LL``) -- it
    failed to make a new extreme, so it is not a continuation.
    """
    labeled: list[Pivot] = []
    prev_high: Pivot | None = None
    prev_low: Pivot | None = None

    for pivot in pivots:
        if pivot.kind == HIGH:
            if prev_high is None:
                label = "High"
            else:
                label = "HH" if pivot.price > prev_high.price else "LH"
            marked = replace(pivot, label=label)
            prev_high = marked
        else:
            if prev_low is None:
                label = "Low"
            else:
                label = "HL" if pivot.price > prev_low.price else "LL"
            marked = replace(pivot, label=label)
            prev_low = marked
        labeled.append(marked)
    return labeled


def trend_from_labels(pivots: list[Pivot]) -> str:
    """Read the trend off the most recent swing high and swing low labels."""
    last_high = next((p for p in reversed(pivots) if p.kind == HIGH), None)
    last_low = next((p for p in reversed(pivots) if p.kind == LOW), None)
    if last_high is None or last_low is None:
        return RANGE
    if last_high.label == "HH" and last_low.label == "HL":
        return UPTREND
    if last_high.label == "LH" and last_low.label == "LL":
        return DOWNTREND
    return RANGE


def build_structure(pivots: list[Pivot], min_swing_pct: float = 0.0) -> Structure:
    """Alternate, noise-filter and label a list of raw pivots."""
    kept: list[Pivot] = []
    for pivot in pivots:
        kept = admit_pivot(kept, pivot, min_swing_pct)
    labeled = label_pivots(kept)
    return Structure(pivots=labeled, trend=trend_from_labels(labeled))


def analyze(
    candles: list[Candle],
    depth: int = 3,
    min_swing_pct: float = 0.0,
) -> Structure:
    """Full structure for a candle series (what you would see drawn on a chart)."""
    return build_structure(find_raw_pivots(candles, depth), min_swing_pct)
