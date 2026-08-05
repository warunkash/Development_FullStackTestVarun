"""Unit tests for the pure classification/scanning logic (no network calls)."""

from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from nifty500_screener.constituents import Constituent, _parse_csv
from nifty500_screener.screener import Mover, classify, screen_eod, screen_intraday
from nifty500_screener.yahoo_client import DailyBar, Quote, QuoteError


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

    def test_zero_is_never_flagged(self):
        self.assertIsNone(classify(0.0, 15, 20))


class ParseCsvTests(unittest.TestCase):
    def test_parses_nse_format(self):
        csv_text = (
            "Company Name,Industry,Symbol,Series,ISIN Code\n"
            "Reliance Industries Ltd.,Energy,RELIANCE,EQ,INE002A01018\n"
        )
        constituents = _parse_csv(csv_text)
        self.assertEqual(len(constituents), 1)
        self.assertEqual(constituents[0].symbol, "RELIANCE")
        self.assertEqual(constituents[0].yahoo_symbol, "RELIANCE.NS")

    def test_skips_blank_symbol_rows(self):
        csv_text = "Company Name,Industry,Symbol,Series,ISIN Code\n,,,,\n"
        self.assertEqual(_parse_csv(csv_text), [])


class ScanTests(unittest.TestCase):
    def setUp(self):
        self.constituents = [
            Constituent("Surge Corp", "Tech", "SURGEC", "ISIN1"),
            Constituent("Plunge Corp", "Tech", "PLUNGEC", "ISIN2"),
            Constituent("Flat Corp", "Tech", "FLATC", "ISIN3"),
            Constituent("Broken Corp", "Tech", "BROKEC", "ISIN4"),
        ]

    def test_screen_intraday_filters_and_sorts(self):
        quotes = {
            "SURGEC.NS": Quote("SURGEC.NS", 119.0, 100.0, 1_700_000_000),
            "PLUNGEC.NS": Quote("PLUNGEC.NS", 84.0, 100.0, 1_700_000_000),
            "FLATC.NS": Quote("FLATC.NS", 101.0, 100.0, 1_700_000_000),
        }

        def fake_fetch_quote(symbol, session, timeout=10.0, retries=2):
            if symbol not in quotes:
                raise QuoteError("boom")
            return quotes[symbol]

        with patch("nifty500_screener.screener.fetch_quote", side_effect=fake_fetch_quote):
            movers, errors = screen_intraday(self.constituents, min_pct=15, max_pct=20, max_workers=4)

        self.assertEqual([m.symbol for m in movers], ["SURGEC", "PLUNGEC"])
        self.assertEqual(movers[0].direction, "SURGE")
        self.assertEqual(movers[1].direction, "PLUNGE")
        self.assertEqual(len(errors), 1)
        self.assertIn("BROKEC", errors[0])

    def test_screen_eod_uses_last_two_closes(self):
        bars = {
            "SURGEC.NS": [DailyBar(1, 100.0), DailyBar(2, 119.0)],
            "PLUNGEC.NS": [DailyBar(1, 100.0), DailyBar(2, 81.0)],
            "FLATC.NS": [DailyBar(1, 100.0), DailyBar(2, 100.5)],
        }

        def fake_fetch_daily_closes(symbol, session, timeout=10.0, retries=2, lookback_range="5d"):
            if symbol not in bars:
                raise QuoteError("boom")
            return bars[symbol]

        with patch("nifty500_screener.screener.fetch_daily_closes", side_effect=fake_fetch_daily_closes):
            movers, errors = screen_eod(self.constituents, min_pct=15, max_pct=20, max_workers=4)

        self.assertEqual({m.symbol for m in movers}, {"SURGEC", "PLUNGEC"})
        self.assertEqual(len(errors), 1)


if __name__ == "__main__":
    unittest.main()
