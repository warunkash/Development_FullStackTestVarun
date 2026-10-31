"""Unit tests for the hourly screener's pure logic (no network calls)."""

from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from nifty500_screener_hourly.constituents import Constituent
from nifty500_screener_hourly.screener import Mover, _todays_session_bars, classify, screen_eod, screen_live
from nifty500_screener_hourly.yahoo_client import HourBar, QuoteError

# A few hourly epoch timestamps (UTC), landing on different IST calendar days.
YESTERDAY_1515 = int(datetime(2026, 10, 29, 9, 45, tzinfo=timezone.utc).timestamp())  # 15:15 IST the day before
TODAY_0915 = int(datetime(2026, 10, 30, 3, 45, tzinfo=timezone.utc).timestamp())      # 09:15 IST
TODAY_1015 = int(datetime(2026, 10, 30, 4, 45, tzinfo=timezone.utc).timestamp())      # 10:15 IST
TODAY_1115 = int(datetime(2026, 10, 30, 5, 45, tzinfo=timezone.utc).timestamp())      # 11:15 IST


class ClassifyTests(unittest.TestCase):
    def test_surge_within_band(self):
        self.assertEqual(classify(17.5, 15, 20), "SURGE")

    def test_plunge_within_band(self):
        self.assertEqual(classify(-16.0, 15, 20), "PLUNGE")

    def test_below_band_excluded(self):
        self.assertIsNone(classify(9.9, 15, 20))

    def test_above_band_excluded(self):
        self.assertIsNone(classify(25.0, 15, 20))

    def test_boundary_inclusive(self):
        self.assertEqual(classify(15.0, 15, 20), "SURGE")
        self.assertEqual(classify(-20.0, 15, 20), "PLUNGE")


class TodaysSessionBarsTests(unittest.TestCase):
    def test_drops_prior_day_bars(self):
        bars = [
            HourBar(YESTERDAY_1515, 100.0),
            HourBar(TODAY_0915, 101.0),
            HourBar(TODAY_1015, 102.0),
            HourBar(TODAY_1115, 103.0),
        ]
        result = _todays_session_bars(bars)
        self.assertEqual([b.time_epoch for b in result], [TODAY_0915, TODAY_1015, TODAY_1115])

    def test_empty_input(self):
        self.assertEqual(_todays_session_bars([]), [])


class ScanTests(unittest.TestCase):
    def setUp(self):
        self.constituents = [
            Constituent("Surge Corp", "Tech", "SURGEC", "ISIN1"),
            Constituent("Plunge Corp", "Tech", "PLUNGEC", "ISIN2"),
            Constituent("Flat Corp", "Tech", "FLATC", "ISIN3"),
            Constituent("Broken Corp", "Tech", "BROKEC", "ISIN4"),
        ]

    def test_screen_live_uses_last_two_bars_of_today(self):
        bars = {
            # overnight gap (yesterday->today) is huge but must be ignored;
            # the in-band move is the most recent hour only.
            "SURGEC.NS": [HourBar(YESTERDAY_1515, 50.0), HourBar(TODAY_0915, 100.0), HourBar(TODAY_1015, 119.0)],
            "PLUNGEC.NS": [HourBar(TODAY_0915, 100.0), HourBar(TODAY_1015, 101.0), HourBar(TODAY_1115, 82.0)],
            "FLATC.NS": [HourBar(TODAY_0915, 100.0), HourBar(TODAY_1015, 100.5)],
        }

        def fake_fetch(symbol, session, timeout=10.0, retries=2, lookback_range="5d"):
            if symbol not in bars:
                raise QuoteError("boom")
            return bars[symbol]

        with patch("nifty500_screener_hourly.screener.fetch_hourly_bars", side_effect=fake_fetch):
            movers, errors = screen_live(self.constituents, min_pct=15, max_pct=20, max_workers=4)

        self.assertEqual({m.symbol for m in movers}, {"SURGEC", "PLUNGEC"})
        self.assertEqual(len(errors), 1)
        self.assertIn("BROKEC", errors[0])

    def test_screen_eod_picks_largest_qualifying_hour(self):
        bars = {
            # Two candidate hours; only the second is in-band, eod must pick it.
            "SURGEC.NS": [
                HourBar(TODAY_0915, 100.0),
                HourBar(TODAY_1015, 105.0),   # +5%, not in band
                HourBar(TODAY_1115, 125.0),   # +19.05%, in band
            ],
            "FLATC.NS": [HourBar(TODAY_0915, 100.0), HourBar(TODAY_1015, 100.5)],
        }

        def fake_fetch(symbol, session, timeout=10.0, retries=2, lookback_range="5d"):
            if symbol not in bars:
                raise QuoteError("boom")
            return bars[symbol]

        with patch("nifty500_screener_hourly.screener.fetch_hourly_bars", side_effect=fake_fetch):
            movers, errors = screen_eod([self.constituents[0], self.constituents[2]], min_pct=15, max_pct=20, max_workers=4)

        self.assertEqual(len(movers), 1)
        self.assertEqual(movers[0].symbol, "SURGEC")
        self.assertAlmostEqual(movers[0].pct_change, 19.047619, places=4)
        self.assertEqual(movers[0].as_of, datetime.fromtimestamp(TODAY_1115, tz=timezone.utc))


if __name__ == "__main__":
    unittest.main()
