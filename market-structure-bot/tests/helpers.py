"""Synthetic candle builders so the tests never touch the network."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from market_structure_bot.candles import Candle  # noqa: E402

BASE_EPOCH = 1_723_000_000
STEP = 300  # 5 minutes


def candle(index: int, high: float, low: float, close: float | None = None) -> Candle:
    """A bar whose high/low are what matter; close defaults to the midpoint."""
    mid = (high + low) / 2
    close = mid if close is None else close
    return Candle(
        epoch=BASE_EPOCH + index * STEP,
        open=mid,
        high=high,
        low=low,
        close=close,
        volume=1000.0,
    )


def series(prices: list[float], spread: float = 0.5) -> list[Candle]:
    """Build candles from a close path, giving each bar a small symmetric range.

    The path itself decides where swings land, which keeps the tests readable:
    ``[10, 12, 10]`` is a swing high at index 1.
    """
    return [
        candle(i, high=p + spread, low=p - spread, close=p)
        for i, p in enumerate(prices)
    ]


def flat(n: int, price: float = 100.0, start: int = 0) -> list[float]:
    """``n`` bars of noise-free filler at ``price``, offset so indices stay unique."""
    return [price] * n
