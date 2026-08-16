"""Scan a list of symbols concurrently and surface the fresh structure breaks."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

import requests

from .candles import CandleError, drop_forming_candle, fetch_candles, interval_seconds
from .signals import Analysis, replay

logger = logging.getLogger(__name__)

DEFAULT_WATCHLIST = [
    "TATAPOWER", "RELIANCE", "HDFCBANK", "ICICIBANK", "INFY",
    "TCS", "SBIN", "AXISBANK", "ITC", "LT",
]


@dataclass(frozen=True)
class ScanResult:
    symbol: str
    analysis: Analysis | None
    error: str | None = None


def analyze_symbol(
    symbol: str,
    interval: str = "5m",
    lookback: str = "1mo",
    depth: int = 3,
    min_swing_pct: float = 0.0,
    reward_multiple: float = 2.0,
    use_wicks: bool = False,
    session: requests.Session | None = None,
    include_forming: bool = False,
) -> Analysis:
    """Fetch candles for one symbol and run the structure replay over them."""
    candles = fetch_candles(symbol, interval=interval, lookback=lookback, session=session)
    if not include_forming:
        candles = drop_forming_candle(candles, interval_seconds(interval))
    if len(candles) < depth * 2 + 2:
        raise CandleError(f"{symbol}: only {len(candles)} candles, need at least {depth * 2 + 2}")
    return replay(
        candles,
        symbol=symbol,
        interval=interval,
        depth=depth,
        min_swing_pct=min_swing_pct,
        reward_multiple=reward_multiple,
        use_wicks=use_wicks,
    )


def scan(
    symbols: list[str],
    workers: int = 8,
    **kwargs,
) -> list[ScanResult]:
    """Analyze every symbol, keeping failures as :class:`ScanResult` errors.

    One symbol that Yahoo has no data for should not sink the whole sweep, so
    errors are collected per symbol instead of raised.
    """
    session = requests.Session()

    def run(symbol: str) -> ScanResult:
        try:
            return ScanResult(symbol=symbol, analysis=analyze_symbol(symbol, session=session, **kwargs))
        except (CandleError, requests.RequestException) as exc:
            logger.warning("%s: %s", symbol, exc)
            return ScanResult(symbol=symbol, analysis=None, error=str(exc))

    try:
        with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
            return list(pool.map(run, symbols))
    finally:
        session.close()


def fresh_signals(
    results: list[ScanResult],
    max_age_bars: int = 3,
    kinds: set[str] | None = None,
) -> list[ScanResult]:
    """Keep only symbols whose most recent signal landed within the last N bars."""
    hits = []
    for result in results:
        analysis = result.analysis
        if analysis is None or not analysis.signals:
            continue
        age = analysis.bars_since_last_signal()
        if age is None or age > max_age_bars:
            continue
        if kinds and analysis.signals[-1].kind not in kinds:
            continue
        hits.append(result)
    hits.sort(key=lambda r: r.analysis.bars_since_last_signal() or 0)
    return hits


def load_symbols(raw: str | None, path: str | None) -> list[str]:
    """Resolve the symbol list from ``--symbols`` / ``--symbols-file`` / default."""
    if raw:
        return [s.strip().upper() for s in raw.split(",") if s.strip()]
    if path:
        with open(path, encoding="utf-8") as fh:
            return [
                line.strip().upper()
                for line in fh
                if line.strip() and not line.startswith("#")
            ]
    return list(DEFAULT_WATCHLIST)
