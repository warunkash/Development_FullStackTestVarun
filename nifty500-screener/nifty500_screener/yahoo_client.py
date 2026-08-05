"""Thin client around Yahoo Finance's unofficial chart API.

Yahoo Finance has no official free API, but its ``/v8/finance/chart``
endpoint is publicly reachable and returns everything needed here: the
live/last price, the previous session's close, and recent daily bars for
end-of-day close-to-close comparisons.
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
    """Raised when a symbol's quote/history could not be retrieved."""


@dataclass(frozen=True)
class Quote:
    """A snapshot suitable for intraday (live vs. previous close) screening."""

    symbol: str
    last_price: float
    previous_close: float
    market_time_epoch: int

    @property
    def pct_change(self) -> float:
        if not self.previous_close:
            return 0.0
        return (self.last_price - self.previous_close) / self.previous_close * 100.0


@dataclass(frozen=True)
class DailyBar:
    date_epoch: int
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


def fetch_quote(
    yahoo_symbol: str,
    session: requests.Session,
    timeout: float = 10.0,
    retries: int = 2,
) -> Quote:
    """Fetch a live intraday quote: current price vs. previous session close."""
    url = CHART_URL.format(symbol=yahoo_symbol)
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            result = _get_json(url, session, timeout, params={"interval": "1d", "range": "1d"})
            meta = result["meta"]
            return Quote(
                symbol=yahoo_symbol,
                last_price=float(meta["regularMarketPrice"]),
                previous_close=float(meta["chartPreviousClose"]),
                market_time_epoch=int(meta.get("regularMarketTime", 0)),
            )
        except (QuoteError, requests.RequestException, KeyError, TypeError, ValueError) as exc:
            last_exc = exc
            if attempt < retries:
                time.sleep(0.5 * (attempt + 1))
    raise QuoteError(f"{yahoo_symbol}: {last_exc}")


def fetch_daily_closes(
    yahoo_symbol: str,
    session: requests.Session,
    timeout: float = 10.0,
    retries: int = 2,
    lookback_range: str = "5d",
) -> list[DailyBar]:
    """Fetch recent official daily closes, most recent last.

    Used for end-of-day screening: compares the latest completed session's
    close against the prior session's close, independent of when the
    script is actually run.
    """
    url = CHART_URL.format(symbol=yahoo_symbol)
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            result = _get_json(
                url, session, timeout, params={"interval": "1d", "range": lookback_range}
            )
            timestamps = result.get("timestamp") or []
            closes = result["indicators"]["quote"][0]["close"]
            bars = [
                DailyBar(date_epoch=ts, close=float(c))
                for ts, c in zip(timestamps, closes)
                if c is not None
            ]
            if len(bars) < 2:
                raise QuoteError("fewer than 2 daily closes returned")
            return bars
        except (QuoteError, requests.RequestException, KeyError, TypeError, ValueError, IndexError) as exc:
            last_exc = exc
            if attempt < retries:
                time.sleep(0.5 * (attempt + 1))
    raise QuoteError(f"{yahoo_symbol}: {last_exc}")
