"""NSE market-hours helpers (IST, Mon-Fri 09:15-15:30).

This does not account for NSE trading holidays (Diwali, Republic Day,
etc.) since that list changes yearly and would need its own maintained
source; it only checks weekday + time-of-day.
"""

from __future__ import annotations

from datetime import datetime, time
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
MARKET_OPEN = time(9, 15)
MARKET_CLOSE = time(15, 30)


def now_ist() -> datetime:
    return datetime.now(IST)


def is_market_open(moment: datetime | None = None) -> bool:
    moment = moment.astimezone(IST) if moment else now_ist()
    if moment.weekday() >= 5:  # Saturday/Sunday
        return False
    return MARKET_OPEN <= moment.time() <= MARKET_CLOSE
