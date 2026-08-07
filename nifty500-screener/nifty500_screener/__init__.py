"""Nifty 500 daily mover screener.

Flags stocks whose price has moved (up or down) between a configurable
percentage band — default 15%-20% — either intraday (live vs. previous
close) or end-of-day (official close vs. previous close).
"""

__version__ = "0.1.0"
