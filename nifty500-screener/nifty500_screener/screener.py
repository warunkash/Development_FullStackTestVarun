"""Core screening logic: find Nifty 500 stocks moving 15%-20% in a day."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone

import requests

from .constituents import Constituent
from .yahoo_client import QuoteError, fetch_daily_closes, fetch_quote

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Mover:
    symbol: str
    company_name: str
    industry: str
    direction: str  # "SURGE" or "PLUNGE"
    pct_change: float
    reference_price: float  # previous close
    current_price: float  # live price (intraday) or latest close (EOD)
    as_of: datetime


def classify(pct_change: float, min_pct: float, max_pct: float) -> str | None:
    """Return 'SURGE', 'PLUNGE', or None if outside the [min_pct, max_pct] band."""
    magnitude = abs(pct_change)
    if min_pct <= magnitude <= max_pct:
        return "SURGE" if pct_change > 0 else "PLUNGE"
    return None


def _scan(
    constituents: list[Constituent],
    fetch_one,
    min_pct: float,
    max_pct: float,
    max_workers: int,
) -> tuple[list[Mover], list[str]]:
    """Run ``fetch_one(constituent, session) -> Mover | None`` concurrently."""
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


def _intraday_one(constituent: Constituent, session, min_pct: float, max_pct: float) -> Mover | None:
    quote = fetch_quote(constituent.yahoo_symbol, session)
    direction = classify(quote.pct_change, min_pct, max_pct)
    if direction is None:
        return None
    as_of = (
        datetime.fromtimestamp(quote.market_time_epoch, tz=timezone.utc)
        if quote.market_time_epoch
        else datetime.now(tz=timezone.utc)
    )
    return Mover(
        symbol=constituent.symbol,
        company_name=constituent.company_name,
        industry=constituent.industry,
        direction=direction,
        pct_change=quote.pct_change,
        reference_price=quote.previous_close,
        current_price=quote.last_price,
        as_of=as_of,
    )


def _eod_one(constituent: Constituent, session, min_pct: float, max_pct: float) -> Mover | None:
    bars = fetch_daily_closes(constituent.yahoo_symbol, session)
    latest, previous = bars[-1], bars[-2]
    pct_change = (latest.close - previous.close) / previous.close * 100.0 if previous.close else 0.0
    direction = classify(pct_change, min_pct, max_pct)
    if direction is None:
        return None
    return Mover(
        symbol=constituent.symbol,
        company_name=constituent.company_name,
        industry=constituent.industry,
        direction=direction,
        pct_change=pct_change,
        reference_price=previous.close,
        current_price=latest.close,
        as_of=datetime.fromtimestamp(latest.date_epoch, tz=timezone.utc),
    )


def screen_intraday(
    constituents: list[Constituent],
    min_pct: float = 15.0,
    max_pct: float = 20.0,
    max_workers: int = 20,
) -> tuple[list[Mover], list[str]]:
    """Screen using live price vs. previous session's close."""
    return _scan(constituents, _intraday_one, min_pct, max_pct, max_workers)


def screen_eod(
    constituents: list[Constituent],
    min_pct: float = 15.0,
    max_pct: float = 20.0,
    max_workers: int = 20,
) -> tuple[list[Mover], list[str]]:
    """Screen using the latest completed session's official close vs. the prior close."""
    return _scan(constituents, _eod_one, min_pct, max_pct, max_workers)
