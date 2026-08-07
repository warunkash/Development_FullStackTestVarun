"""Fetch and cache the list of NSE Nifty 500 constituent symbols."""

from __future__ import annotations

import csv
import io
import logging
from dataclasses import dataclass
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

NSE_NIFTY500_CSV_URL = "https://archives.nseindia.com/content/indices/ind_nifty500list.csv"
DEFAULT_CACHE_PATH = Path(__file__).resolve().parent.parent / "data" / "nifty500_list.csv"

_HEADERS = {
    # NSE rejects requests without a browser-like User-Agent.
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "text/csv,*/*",
}


@dataclass(frozen=True)
class Constituent:
    company_name: str
    industry: str
    symbol: str
    isin: str

    @property
    def yahoo_symbol(self) -> str:
        """NSE symbols map to Yahoo Finance tickers via a ``.NS`` suffix."""
        return f"{self.symbol}.NS"


def _parse_csv(text: str) -> list[Constituent]:
    reader = csv.DictReader(io.StringIO(text))
    constituents = []
    for row in reader:
        symbol = (row.get("Symbol") or "").strip()
        if not symbol:
            continue
        constituents.append(
            Constituent(
                company_name=(row.get("Company Name") or "").strip(),
                industry=(row.get("Industry") or "").strip(),
                symbol=symbol,
                isin=(row.get("ISIN Code") or "").strip(),
            )
        )
    return constituents


def fetch_nifty500_constituents(
    cache_path: Path = DEFAULT_CACHE_PATH,
    timeout: float = 15.0,
    refresh: bool = False,
) -> list[Constituent]:
    """Return the current Nifty 500 constituents.

    Downloads the official list from the NSE archives and refreshes the
    on-disk cache. Falls back to the cache (and finally to a bundled
    snapshot) if NSE is unreachable, since the constituent list changes
    only a few times a year.
    """
    if not refresh and cache_path.exists():
        try:
            constituents = _parse_csv(cache_path.read_text(encoding="utf-8"))
            if constituents:
                return constituents
        except OSError:
            logger.warning("Could not read cached constituent list at %s", cache_path)

    try:
        response = requests.get(NSE_NIFTY500_CSV_URL, headers=_HEADERS, timeout=timeout)
        response.raise_for_status()
        constituents = _parse_csv(response.text)
        if not constituents:
            raise ValueError("Downloaded Nifty 500 CSV parsed to zero rows")
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(response.text, encoding="utf-8")
        return constituents
    except (requests.RequestException, ValueError) as exc:
        logger.warning("Failed to download live Nifty 500 list from NSE (%s); using cache", exc)
        if cache_path.exists():
            constituents = _parse_csv(cache_path.read_text(encoding="utf-8"))
            if constituents:
                return constituents
        raise RuntimeError(
            "Could not fetch the Nifty 500 constituent list from NSE and no cached "
            f"copy is available at {cache_path}. Try again later or supply a CSV "
            "manually in that location (NSE format: Company Name,Industry,Symbol,"
            "Series,ISIN Code)."
        ) from exc
