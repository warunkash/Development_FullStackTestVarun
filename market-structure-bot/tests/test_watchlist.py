"""Watchlist filtering and symbol resolution (no network)."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from helpers import series

from market_structure_bot.signals import BOS, CHOCH, replay
from market_structure_bot.watchlist import (
    DEFAULT_WATCHLIST,
    ScanResult,
    fresh_signals,
    load_symbols,
)

BOS_PATH = [100, 90, 100, 110, 100, 95, 100, 112, 105, 100, 118]


def result(symbol: str, path: list[float], padding: int = 0) -> ScanResult:
    """A scan result whose last signal is ``padding`` bars old."""
    candles = series(path + [path[-1]] * padding)
    return ScanResult(symbol=symbol, analysis=replay(candles, symbol=symbol, depth=1))


class FreshSignalTests(unittest.TestCase):
    def test_a_recent_break_is_reported(self):
        hits = fresh_signals([result("A", BOS_PATH)], max_age_bars=3)
        self.assertEqual([h.symbol for h in hits], ["A"])

    def test_a_stale_break_is_filtered_out(self):
        hits = fresh_signals([result("A", BOS_PATH, padding=20)], max_age_bars=3)
        self.assertEqual(hits, [])

    def test_symbols_without_signals_are_skipped(self):
        quiet = ScanResult("QUIET", replay(series([100] * 30), symbol="QUIET", depth=2))
        self.assertEqual(fresh_signals([quiet], max_age_bars=3), [])

    def test_failed_symbols_are_skipped(self):
        failed = ScanResult("BROKEN", None, error="404")
        self.assertEqual(fresh_signals([failed], max_age_bars=3), [])

    def test_kind_filter_narrows_to_the_requested_signal_types(self):
        hits = fresh_signals([result("A", BOS_PATH)], max_age_bars=3, kinds={CHOCH})
        self.assertEqual(hits, [])

        hits = fresh_signals([result("A", BOS_PATH)], max_age_bars=3, kinds={BOS})
        self.assertEqual([h.symbol for h in hits], ["A"])

    def test_freshest_break_sorts_first(self):
        results = [result("OLD", BOS_PATH, padding=3), result("NEW", BOS_PATH)]
        hits = fresh_signals(results, max_age_bars=5)

        self.assertEqual([h.symbol for h in hits], ["NEW", "OLD"])


class LoadSymbolsTests(unittest.TestCase):
    def test_inline_symbols_are_split_and_upcased(self):
        self.assertEqual(load_symbols("tatapower, sbin ,itc", None), ["TATAPOWER", "SBIN", "ITC"])

    def test_a_file_is_read_one_symbol_per_line_ignoring_comments(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "watchlist.txt"
            path.write_text("# my list\ntatapower\n\nsbin\n", encoding="utf-8")

            self.assertEqual(load_symbols(None, str(path)), ["TATAPOWER", "SBIN"])

    def test_inline_symbols_win_over_a_file(self):
        self.assertEqual(load_symbols("ITC", "/nonexistent"), ["ITC"])

    def test_falling_back_to_the_bundled_watchlist(self):
        self.assertEqual(load_symbols(None, None), DEFAULT_WATCHLIST)

    def test_the_default_watchlist_is_a_copy(self):
        load_symbols(None, None).append("MUTATED")
        self.assertNotIn("MUTATED", DEFAULT_WATCHLIST)


if __name__ == "__main__":
    unittest.main()
