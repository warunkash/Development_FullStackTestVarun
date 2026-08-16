"""Chart-payload parsing and interval bookkeeping (no network)."""

from __future__ import annotations

import time
import unittest

from helpers import series

from market_structure_bot.candles import (
    CandleError,
    clamp_range,
    drop_forming_candle,
    interval_seconds,
    parse_chart_result,
    to_yahoo_symbol,
)


def chart_result(timestamps, opens, highs, lows, closes, volumes=None) -> dict:
    return {
        "timestamp": timestamps,
        "indicators": {
            "quote": [
                {
                    "open": opens, "high": highs, "low": lows,
                    "close": closes, "volume": volumes or [0] * len(timestamps),
                }
            ]
        },
    }


class SymbolTests(unittest.TestCase):
    def test_bare_nse_symbol_gets_the_ns_suffix(self):
        self.assertEqual(to_yahoo_symbol("tatapower"), "TATAPOWER.NS")

    def test_an_already_suffixed_symbol_is_left_alone(self):
        self.assertEqual(to_yahoo_symbol("TATAPOWER.NS"), "TATAPOWER.NS")
        self.assertEqual(to_yahoo_symbol("^NSEI"), "^NSEI")


class ClampRangeTests(unittest.TestCase):
    def test_a_range_within_the_cap_is_untouched(self):
        self.assertEqual(clamp_range("5m", "1mo"), "1mo")

    def test_an_over_long_range_is_clamped_to_what_yahoo_serves(self):
        self.assertEqual(clamp_range("5m", "1y"), "60d")
        self.assertEqual(clamp_range("1m", "1mo"), "7d")

    def test_an_unknown_interval_passes_through(self):
        self.assertEqual(clamp_range("3m", "1y"), "1y")


class ParseTests(unittest.TestCase):
    def test_parses_a_well_formed_payload(self):
        result = chart_result([1, 2], [10, 11], [12, 13], [9, 10], [11, 12], [100, 200])
        candles = parse_chart_result(result)

        self.assertEqual(len(candles), 2)
        self.assertEqual(candles[0].high, 12.0)
        self.assertEqual(candles[1].volume, 200.0)

    def test_null_bars_are_dropped_not_interpolated(self):
        # A fabricated bar would invent a swing point that never traded.
        result = chart_result([1, 2, 3], [10, None, 12], [12, None, 14], [9, None, 11], [11, None, 13])
        candles = parse_chart_result(result)

        self.assertEqual([c.epoch for c in candles], [1, 3])

    def test_a_missing_volume_becomes_zero(self):
        result = chart_result([1], [10], [12], [9], [11], [None])
        self.assertEqual(parse_chart_result(result)[0].volume, 0.0)

    def test_an_all_null_payload_raises(self):
        result = chart_result([1, 2], [None, None], [None, None], [None, None], [None, None])
        with self.assertRaises(CandleError):
            parse_chart_result(result)

    def test_a_malformed_payload_raises(self):
        with self.assertRaises(CandleError):
            parse_chart_result({"timestamp": [1, 2]})


class FormingCandleTests(unittest.TestCase):
    def test_the_still_forming_bar_is_dropped(self):
        candles = series([100, 101, 102])
        # Pretend the last bar opened 60s ago on a 5m chart: not closed yet.
        recent = list(candles[:-1]) + [
            candles[-1].__class__(
                epoch=int(time.time()) - 60, open=100, high=101, low=99, close=100, volume=1
            )
        ]
        self.assertEqual(len(drop_forming_candle(recent, 300)), 2)

    def test_a_closed_bar_is_kept(self):
        candles = series([100, 101, 102])  # epochs are far in the past
        self.assertEqual(len(drop_forming_candle(candles, 300)), 3)

    def test_empty_input_is_safe(self):
        self.assertEqual(drop_forming_candle([], 300), [])


class IntervalTests(unittest.TestCase):
    def test_known_intervals(self):
        self.assertEqual(interval_seconds("5m"), 300)
        self.assertEqual(interval_seconds("15m"), 900)
        self.assertEqual(interval_seconds("1h"), 3600)
        self.assertEqual(interval_seconds("1d"), 86400)

    def test_an_unparseable_interval_falls_back_to_five_minutes(self):
        self.assertEqual(interval_seconds("weird"), 300)


if __name__ == "__main__":
    unittest.main()
