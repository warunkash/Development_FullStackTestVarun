"""Nifty 500 hourly mover screener.

Same idea as the daily screener, but applied to hourly candles instead of
daily closes: flags stocks whose price moved (up or down) between a
configurable percentage band — default 15%-20% — within a single trading
hour, either live (the currently-forming hour) or end-of-day (any
completed hour of the day's session).
"""

__version__ = "0.1.0"
