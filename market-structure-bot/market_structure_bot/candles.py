"""Intraday OHLC candles from Yahoo Finance's unofficial chart API.

Same endpoint the Nifty 500 screener uses (``/v8/finance/chart``), but asking
for intraday intervals (``5m``, ``15m``, ...) and reading the full OHLCV
arrays instead of just the last price.

Yahoo caps how far back each intraday interval goes -- roughly 60 days for
``5m``/``15m``/``30m``/``1h`` and 7 days for ``1m``. Ask for more and the
endpoint quietly returns less, so :func:`fetch_candles` clamps the range to
what the interval actually supports.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime

import requests

from .market_hours import IST

logger = logging.getLogger(__name__)

CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

#: Longest ``range`` Yahoo will serve for each intraday ``interval``.
MAX_RANGE_BY_INTERVAL = {
    "1m": "7d",
    "2m": "60d",
    "5m": "60d",
    "15m": "60d",
    "30m": "60d",
    "60m": "60d",
    "1h": "60d",
    "1d": "2y",
}

_RANGE_DAYS = {
    "1d": 1, "5d": 5, "7d": 7, "1mo": 30, "60d": 60,
    "3mo": 90, "6mo": 180, "1y": 365, "2y": 730,
}


class CandleError(Exception):
    """Raised when candles for a symbol could not be retrieved."""


@dataclass(frozen=True)
class Candle:
    """One OHLCV bar. ``epoch`` is the bar's *open* time, in UTC seconds."""

    epoch: int
    open: float
    high: float
    low: float
    close: float
    volume: float

    @property
    def time_ist(self) -> datetime:
        return datetime.fromtimestamp(self.epoch, tz=IST)


def to_yahoo_symbol(symbol: str, suffix: str = ".NS") -> str:
    """``TATAPOWER`` -> ``TATAPOWER.NS``; anything already suffixed is left alone."""
    symbol = symbol.strip().upper()
    if "." in symbol or "^" in symbol:
        return symbol
    return f"{symbol}{suffix}"


def clamp_range(interval: str, lookback: str) -> str:
    """Shrink ``lookback`` to the longest range Yahoo serves for ``interval``."""
    cap = MAX_RANGE_BY_INTERVAL.get(interval)
    if cap is None:
        return lookback
    wanted, allowed = _RANGE_DAYS.get(lookback), _RANGE_DAYS.get(cap)
    if wanted is None or allowed is None or wanted <= allowed:
        return lookback
    logger.debug("range %s too long for interval %s, using %s", lookback, interval, cap)
    return cap


def parse_chart_result(result: dict) -> list[Candle]:
    """Turn one Yahoo ``chart.result`` entry into candles, oldest first.

    Yahoo pads its arrays with ``null`` for bars it has no data for (halts,
    pre-open placeholders, the still-forming bar on some symbols). Those rows
    are dropped rather than interpolated -- a fabricated bar would create a
    fake swing point.
    """
    timestamps = result.get("timestamp") or []
    try:
        quote = result["indicators"]["quote"][0]
    except (KeyError, IndexError, TypeError) as exc:
        raise CandleError(f"malformed chart payload: {exc}") from exc

    opens, highs = quote.get("open") or [], quote.get("high") or []
    lows, closes = quote.get("low") or [], quote.get("close") or []
    volumes = quote.get("volume") or [None] * len(timestamps)

    candles: list[Candle] = []
    for i, ts in enumerate(timestamps):
        try:
            o, h, l, c = opens[i], highs[i], lows[i], closes[i]
        except IndexError:
            break
        if None in (o, h, l, c):
            continue
        v = volumes[i] if i < len(volumes) and volumes[i] is not None else 0
        candles.append(
            Candle(epoch=int(ts), open=float(o), high=float(h),
                   low=float(l), close=float(c), volume=float(v))
        )
    if not candles:
        raise CandleError("no usable candles in chart payload")
    return candles


def fetch_candles(
    symbol: str,
    interval: str = "5m",
    lookback: str = "1mo",
    session: requests.Session | None = None,
    timeout: float = 15.0,
    retries: int = 2,
    include_prepost: bool = False,
) -> list[Candle]:
    """Fetch intraday candles for ``symbol`` (NSE symbols get ``.NS`` appended)."""
    yahoo_symbol = to_yahoo_symbol(symbol)
    url = CHART_URL.format(symbol=yahoo_symbol)
    params = {
        "interval": interval,
        "range": clamp_range(interval, lookback),
        "includePrePost": "true" if include_prepost else "false",
    }
    owns_session = session is None
    session = session or requests.Session()
    last_exc: Exception | None = None
    try:
        for attempt in range(retries + 1):
            try:
                response = session.get(url, headers=_HEADERS, timeout=timeout, params=params)
                if response.status_code == 429:
                    raise CandleError("rate limited (HTTP 429)")
                response.raise_for_status()
                payload = response.json()
                error = payload.get("chart", {}).get("error")
                if error:
                    raise CandleError(str(error))
                results = payload.get("chart", {}).get("result")
                if not results:
                    raise CandleError("empty chart result")
                return parse_chart_result(results[0])
            except (CandleError, requests.RequestException, ValueError) as exc:
                last_exc = exc
                if attempt < retries:
                    time.sleep(0.5 * (attempt + 1))
    finally:
        if owns_session:
            session.close()
    raise CandleError(f"{yahoo_symbol}: {last_exc}")


def drop_forming_candle(candles: list[Candle], interval_seconds: int) -> list[Candle]:
    """Drop the last bar if its period has not elapsed yet.

    The most recent intraday bar is still being built while the market is
    open. Its high/low keep moving, so treating it as final would let a swing
    point appear and then vanish. Signals are taken on *closed* bars only.
    """
    if not candles:
        return candles
    now = time.time()
    if candles[-1].epoch + interval_seconds > now:
        return candles[:-1]
    return candles


def interval_seconds(interval: str) -> int:
    """``"5m"`` -> 300. Falls back to 5 minutes for anything unrecognised."""
    unit, value = interval[-1], interval[:-1]
    try:
        n = int(value)
    except ValueError:
        return 300
    return {"m": 60, "h": 3600, "d": 86400}.get(unit, 60) * n
