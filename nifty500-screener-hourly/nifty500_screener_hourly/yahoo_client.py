"""Thin client around Yahoo Finance's unofficial chart API, hourly candles.

Same endpoint as the daily screener (``/v8/finance/chart``), but requested
with ``interval=60m`` to get one bar per trading hour instead of one per
day. NSE's 09:15-15:30 IST session yields roughly 6-7 hourly bars/day.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import requests

logger = logging.getLogger(__name__)

CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "application/json",
}


class QuoteError(Exception):
    """Raised when a symbol's hourly bars could not be retrieved."""


@dataclass(frozen=True)
class HourBar:
    """One hourly candle. ``close`` is the bar's closing price."""

    time_epoch: int
    close: float


def _get_json(url: str, session: requests.Session, timeout: float, params: dict | None = None) -> dict:
    response = session.get(url, headers=_HEADERS, timeout=timeout, params=params)
    if response.status_code == 429:
        raise QuoteError("rate limited (HTTP 429)")
    response.raise_for_status()
    payload = response.json()
    error = payload.get("chart", {}).get("error")
    if error:
        raise QuoteError(str(error))
    results = payload.get("chart", {}).get("result")
    if not results:
        raise QuoteError("empty chart result")
    return results[0]


def fetch_hourly_bars(
    yahoo_symbol: str,
    session: requests.Session,
    timeout: float = 10.0,
    retries: int = 2,
    lookback_range: str = "5d",
) -> list[HourBar]:
    """Fetch recent hourly candles, most recent last.

    The last bar in a live request is the currently-forming hour (its
    close is the latest traded price so far this hour); every bar before
    it is a completed hour. ``lookback_range`` controls how many days of
    hourly history come back (Yahoo allows up to ~2 years for 60m bars,
    but a few days is plenty here).
    """
    url = CHART_URL.format(symbol=yahoo_symbol)
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            result = _get_json(
                url, session, timeout, params={"interval": "60m", "range": lookback_range}
            )
            timestamps = result.get("timestamp") or []
            closes = result["indicators"]["quote"][0]["close"]
            bars = [
                HourBar(time_epoch=ts, close=float(c))
                for ts, c in zip(timestamps, closes)
                if c is not None
            ]
            if len(bars) < 2:
                raise QuoteError("fewer than 2 hourly bars returned")
            return bars
        except (QuoteError, requests.RequestException, KeyError, TypeError, ValueError, IndexError) as exc:
            last_exc = exc
            if attempt < retries:
                time.sleep(0.5 * (attempt + 1))
    raise QuoteError(f"{yahoo_symbol}: {last_exc}")
