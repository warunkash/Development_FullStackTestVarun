"""Core screening logic: find Nifty 500 stocks moving 15%-20% within an hour."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone

import requests

from .constituents import Constituent
from .market_hours import IST
from .yahoo_client import HourBar, QuoteError, fetch_hourly_bars

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Mover:
    symbol: str
    company_name: str
    industry: str
    direction: str  # "SURGE" or "PLUNGE"
    pct_change: float
    reference_price: float  # previous hourly close
    current_price: float  # latest price in that hour (live) or the hour's close (eod)
    as_of: datetime  # end of the hour the move happened in


def classify(pct_change: float, min_pct: float, max_pct: float) -> str | None:
    """Return 'SURGE', 'PLUNGE', or None if outside the [min_pct, max_pct] band."""
    magnitude = abs(pct_change)
    if min_pct <= magnitude <= max_pct:
        return "SURGE" if pct_change > 0 else "PLUNGE"
    return None


def _todays_session_bars(bars: list[HourBar]) -> list[HourBar]:
    """Keep only the bars from the most recent trading session present.

    Drops the overnight-gap pair (yesterday's last bar -> today's first
    bar) so an overnight move never gets misreported as an hourly one.
    """
    if not bars:
        return bars
    latest_date = datetime.fromtimestamp(bars[-1].time_epoch, tz=IST).date()
    return [b for b in bars if datetime.fromtimestamp(b.time_epoch, tz=IST).date() == latest_date]


def _scan(
    constituents: list[Constituent],
    fetch_one,
    min_pct: float,
    max_pct: float,
    max_workers: int,
) -> tuple[list[Mover], list[str]]:
    """Run ``fetch_one(constituent, session, min_pct, max_pct) -> Mover | None`` concurrently."""
    movers: list[Mover] = []
    errors: list[str] = []
    with requests.Session() as session, ThreadPoolExecutor(max_workers=max_workers) as pool:
        adapter = requests.adapters.HTTPAdapter(pool_connections=max_workers, pool_maxsize=max_workers)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        futures = {
            pool.submit(fetch_one, c, session, min_pct, max_pct): c for c in constituents
        }
        for future in as_completed(futures):
            constituent = futures[future]
            try:
                mover = future.result()
                if mover is not None:
                    movers.append(mover)
            except QuoteError as exc:
                errors.append(f"{constituent.symbol}: {exc}")
    movers.sort(key=lambda m: abs(m.pct_change), reverse=True)
    return movers, errors


def _mover_from_pair(constituent: Constituent, prev: HourBar, cur: HourBar, min_pct: float, max_pct: float) -> Mover | None:
    pct_change = (cur.close - prev.close) / prev.close * 100.0 if prev.close else 0.0
    direction = classify(pct_change, min_pct, max_pct)
    if direction is None:
        return None
    return Mover(
        symbol=constituent.symbol,
        company_name=constituent.company_name,
        industry=constituent.industry,
        direction=direction,
        pct_change=pct_change,
        reference_price=prev.close,
        current_price=cur.close,
        as_of=datetime.fromtimestamp(cur.time_epoch, tz=timezone.utc),
    )


def _live_one(constituent: Constituent, session, min_pct: float, max_pct: float) -> Mover | None:
    """Currently-forming hour's price vs. the previous completed hour's close."""
    bars = fetch_hourly_bars(constituent.yahoo_symbol, session)
    session_bars = _todays_session_bars(bars)
    if len(session_bars) < 2:
        return None
    return _mover_from_pair(constituent, session_bars[-2], session_bars[-1], min_pct, max_pct)


def _eod_one(constituent: Constituent, session, min_pct: float, max_pct: float) -> Mover | None:
    """The single largest hour-over-hour move of the latest session, if it's in band."""
    bars = fetch_hourly_bars(constituent.yahoo_symbol, session)
    session_bars = _todays_session_bars(bars)
    if len(session_bars) < 2:
        return None
    candidates = [
        m
        for prev, cur in zip(session_bars, session_bars[1:])
        if (m := _mover_from_pair(constituent, prev, cur, min_pct, max_pct)) is not None
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda m: abs(m.pct_change))


def screen_live(
    constituents: list[Constituent],
    min_pct: float = 15.0,
    max_pct: float = 20.0,
    max_workers: int = 20,
) -> tuple[list[Mover], list[str]]:
    """Screen the hour that's happening right now."""
    return _scan(constituents, _live_one, min_pct, max_pct, max_workers)


def screen_eod(
    constituents: list[Constituent],
    min_pct: float = 15.0,
    max_pct: float = 20.0,
    max_workers: int = 20,
) -> tuple[list[Mover], list[str]]:
    """Screen every completed hour of the latest session for a qualifying move."""
    return _scan(constituents, _eod_one, min_pct, max_pct, max_workers)
