"""BOS / CHoCH detection, including the no-lookahead guarantee."""

from __future__ import annotations

import random
import unittest

from helpers import candle, series

from market_structure_bot.signals import BEARISH, BOS, BULLISH, CHOCH, replay
from market_structure_bot.structure import DOWNTREND, UPTREND

# A downtrend (LH then LL) that finally closes back above the last swing high.
CHOCH_PATH = [100, 110, 100, 90, 100, 105, 95, 85, 95, 106]

# A clean staircase: HL, HH, HL, then a close through the last swing high.
BOS_PATH = [100, 90, 100, 110, 100, 95, 100, 112, 105, 100, 118]


class BreakDetectionTests(unittest.TestCase):
    def test_close_above_a_lower_high_in_a_downtrend_is_a_choch(self):
        analysis = replay(series(CHOCH_PATH), depth=1)
        last = analysis.last_signal

        self.assertEqual(last.kind, CHOCH)
        self.assertEqual(last.direction, BULLISH)
        self.assertEqual(last.trend_before, DOWNTREND)
        self.assertEqual(last.trend_after, UPTREND)
        self.assertEqual(last.level_label, "LH")
        self.assertEqual(analysis.trend, UPTREND)

    def test_close_above_a_higher_high_in_an_uptrend_is_a_bos(self):
        analysis = replay(series(BOS_PATH), depth=1)
        last = analysis.last_signal

        self.assertEqual(last.kind, BOS)
        self.assertEqual(last.direction, BULLISH)
        self.assertEqual(last.trend_before, UPTREND)
        self.assertEqual(analysis.trend, UPTREND)

    def test_bearish_break_takes_out_the_swing_low(self):
        analysis = replay(series([100, 110, 100, 90, 100, 105, 95, 85]), depth=1)
        bearish = [s for s in analysis.signals if s.direction == BEARISH]

        self.assertTrue(bearish)
        self.assertEqual(analysis.trend, DOWNTREND)
        self.assertLess(bearish[-1].price, bearish[-1].level)

    def test_flat_market_produces_no_signals(self):
        self.assertEqual(replay(series([100] * 30), depth=2).signals, [])

    def test_a_level_only_fires_once(self):
        # Price pops above the swing high and then keeps closing above it for
        # several bars. That is one break, not five.
        analysis = replay(series([100, 110, 100, 90, 100, 111, 112, 113, 114, 115]), depth=1)
        bullish = [s for s in analysis.signals if s.direction == BULLISH]

        self.assertEqual(len(bullish), 1)
        self.assertEqual(bullish[0].index, 5)


class BreakRuleTests(unittest.TestCase):
    def _wick_probe(self):
        """A series whose last bar wicks above the swing high but closes below."""
        bars = series([100, 110, 100, 90, 100])
        bars.append(candle(5, high=120.0, low=99.0, close=101.0))
        return bars

    def test_a_wick_through_the_level_is_not_a_break_by_default(self):
        self.assertEqual(replay(self._wick_probe(), depth=1).signals, [])

    def test_use_wicks_turns_the_same_bar_into_a_break(self):
        signals = replay(self._wick_probe(), depth=1, use_wicks=True).signals

        self.assertEqual(len(signals), 1)
        self.assertEqual(signals[0].direction, BULLISH)

    def test_a_bar_breaking_both_sides_is_skipped(self):
        # An outside bar leaves no way to know which side was hit first, so it
        # must not produce a signal in either direction.
        bars = series([100, 110, 100, 90, 100])
        bars.append(candle(5, high=130.0, low=70.0, close=101.0))
        self.assertEqual(replay(bars, depth=1, use_wicks=True).signals, [])


class RiskTests(unittest.TestCase):
    def test_bullish_stop_sits_at_the_last_swing_low(self):
        analysis = replay(series(BOS_PATH), depth=1)
        last = analysis.last_signal

        self.assertEqual(last.stop, analysis.structure.last_low.price)
        self.assertLess(last.stop, last.price)

    def test_target_is_the_reward_multiple_of_risk(self):
        analysis = replay(series(BOS_PATH), depth=1, reward_multiple=3.0)
        last = analysis.last_signal

        self.assertAlmostEqual(last.target, last.price + 3.0 * (last.price - last.stop))

    def test_risk_pct_is_relative_to_entry(self):
        last = replay(series(BOS_PATH), depth=1).last_signal
        expected = abs(last.price - last.stop) / last.price * 100.0

        self.assertAlmostEqual(last.risk_pct, expected)

    def test_slip_measures_the_gap_between_entry_and_level(self):
        last = replay(series(BOS_PATH), depth=1).last_signal
        expected = abs(last.price - last.level) / last.level * 100.0

        self.assertAlmostEqual(last.slip_pct, expected)

    def test_a_gap_through_the_level_shows_up_as_large_slip(self):
        # Normal break: the close sits just past the level.
        tight = replay(series([100, 110, 100, 90, 100, 111]), depth=1).last_signal
        # Gap break: the bar opens far above the level and closes there.
        gapped = replay(series([100, 110, 100, 90, 100, 130]), depth=1).last_signal

        self.assertLess(tight.slip_pct, 1.0)
        self.assertGreater(gapped.slip_pct, 10.0)

    def test_signal_points_back_at_the_swing_it_broke(self):
        analysis = replay(series(BOS_PATH), depth=1)
        last = analysis.last_signal
        source = [p for p in analysis.structure.pivots if p.epoch == last.level_epoch]

        self.assertEqual(len(source), 1)
        self.assertEqual(source[0].price, last.level)
        self.assertLess(last.level_time_ist, last.time_ist)

    def test_bearish_target_sits_below_entry(self):
        analysis = replay(series(CHOCH_PATH[:8]), depth=1)
        bearish = [s for s in analysis.signals if s.direction == BEARISH]

        self.assertTrue(bearish)
        self.assertLess(bearish[-1].target, bearish[-1].price)
        self.assertGreater(bearish[-1].stop, bearish[-1].price)


class NoLookaheadTests(unittest.TestCase):
    """The point of the replay: a signal must not depend on later candles."""

    @staticmethod
    def _random_walk(n: int = 300, seed: int = 7) -> list:
        rng = random.Random(seed)
        price, path = 380.0, []
        for _ in range(n):
            price = max(1.0, price + rng.gauss(0, 1.2))
            path.append(round(price, 2))
        return series(path, spread=0.4)

    def test_prefix_replay_matches_the_full_replay(self):
        candles = self._random_walk()
        full = replay(candles, depth=3)
        self.assertTrue(full.signals, "walk produced no signals to compare")

        for cut in range(20, len(candles), 17):
            prefix = replay(candles[:cut], depth=3)
            expected = [s for s in full.signals if s.index < cut]

            self.assertEqual(
                [(s.index, s.kind, s.direction) for s in prefix.signals],
                [(s.index, s.kind, s.direction) for s in expected],
                f"signals changed when the series was cut at {cut}",
            )

    def test_a_signal_never_references_a_pivot_confirmed_later(self):
        candles = self._random_walk()
        analysis = replay(candles, depth=3)

        for signal in analysis.signals:
            matching = [
                p for p in analysis.structure.pivots
                if abs(p.price - signal.level) < 1e-9
            ]
            for pivot in matching:
                self.assertLessEqual(
                    pivot.confirm_index, signal.index,
                    "broke a level that had not been confirmed yet",
                )


class AnalysisTests(unittest.TestCase):
    def test_bars_since_last_signal_counts_closed_bars(self):
        analysis = replay(series(BOS_PATH), depth=1)
        expected = (len(analysis.candles) - 1) - analysis.last_signal.index

        self.assertEqual(analysis.bars_since_last_signal(), expected)

    def test_no_signals_means_no_age(self):
        analysis = replay(series([100] * 20), depth=2)

        self.assertIsNone(analysis.last_signal)
        self.assertIsNone(analysis.bars_since_last_signal())

    def test_describe_mentions_the_broken_level(self):
        last = replay(series(CHOCH_PATH), depth=1).last_signal
        self.assertIn(f"{last.level:.2f}", last.describe())
        self.assertIn(CHOCH, last.describe())


if __name__ == "__main__":
    unittest.main()
