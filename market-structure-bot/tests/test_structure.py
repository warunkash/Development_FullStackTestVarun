"""Swing detection, alternation, labeling and trend classification."""

from __future__ import annotations

import unittest

from helpers import series

from market_structure_bot.structure import (
    DOWNTREND,
    HIGH,
    LOW,
    RANGE,
    UPTREND,
    Pivot,
    admit_pivot,
    analyze,
    build_structure,
    find_raw_pivots,
    label_pivots,
    trend_from_labels,
)


def pivot(index: int, price: float, kind: str) -> Pivot:
    return Pivot(index=index, epoch=index, price=price, kind=kind, confirm_index=index + 1)


class FindRawPivotsTests(unittest.TestCase):
    def test_finds_a_swing_high_and_a_swing_low(self):
        candles = series([10, 12, 10, 8, 10])
        pivots = find_raw_pivots(candles, depth=1)

        self.assertEqual([(p.index, p.kind) for p in pivots], [(1, HIGH), (3, LOW)])
        self.assertAlmostEqual(pivots[0].price, 12.5)  # the bar's high
        self.assertAlmostEqual(pivots[1].price, 7.5)   # the bar's low

    def test_pivot_is_confirmed_depth_bars_after_it_prints(self):
        candles = series([10, 12, 10, 8, 10, 12, 10, 8, 10, 12, 10])
        for p in find_raw_pivots(candles, depth=2):
            self.assertEqual(p.confirm_index, p.index + 2)

    def test_last_depth_bars_are_never_pivots(self):
        # The final bars have no right-hand window, so nothing there can be
        # confirmed yet even though it is the highest price in the series.
        candles = series([10, 11, 12, 13, 99])
        self.assertEqual(find_raw_pivots(candles, depth=1)[-1:], [])

    def test_flat_series_has_no_pivots(self):
        self.assertEqual(find_raw_pivots(series([5] * 10), depth=2), [])

    def test_depth_must_be_positive(self):
        with self.assertRaises(ValueError):
            find_raw_pivots(series([1, 2, 3]), depth=0)


class AlternationTests(unittest.TestCase):
    def test_two_highs_in_a_row_collapse_to_the_higher(self):
        kept = admit_pivot([], pivot(0, 100, HIGH), 0.0)
        kept = admit_pivot(kept, pivot(1, 105, HIGH), 0.0)

        self.assertEqual(len(kept), 1)
        self.assertEqual(kept[0].price, 105)

    def test_a_lower_high_does_not_replace_the_running_high(self):
        kept = admit_pivot([], pivot(0, 105, HIGH), 0.0)
        kept = admit_pivot(kept, pivot(1, 100, HIGH), 0.0)

        self.assertEqual([p.price for p in kept], [105])

    def test_two_lows_in_a_row_collapse_to_the_lower(self):
        kept = admit_pivot([], pivot(0, 100, LOW), 0.0)
        kept = admit_pivot(kept, pivot(1, 95, LOW), 0.0)

        self.assertEqual([p.price for p in kept], [95])

    def test_opposite_kinds_alternate(self):
        kept = admit_pivot([], pivot(0, 100, HIGH), 0.0)
        kept = admit_pivot(kept, pivot(1, 90, LOW), 0.0)

        self.assertEqual([p.kind for p in kept], [HIGH, LOW])

    def test_min_swing_pct_drops_a_leg_that_is_too_small(self):
        kept = admit_pivot([], pivot(0, 100, HIGH), 1.0)
        kept = admit_pivot(kept, pivot(1, 99.5, LOW), 1.0)  # 0.5% move

        self.assertEqual([p.kind for p in kept], [HIGH])

    def test_min_swing_pct_keeps_a_leg_that_clears_the_threshold(self):
        kept = admit_pivot([], pivot(0, 100, HIGH), 1.0)
        kept = admit_pivot(kept, pivot(1, 97, LOW), 1.0)  # 3% move

        self.assertEqual([p.kind for p in kept], [HIGH, LOW])


class LabelTests(unittest.TestCase):
    def test_first_swing_of_each_kind_is_plain_high_low(self):
        labeled = label_pivots([pivot(0, 100, HIGH), pivot(1, 90, LOW)])
        self.assertEqual([p.label for p in labeled], ["High", "Low"])

    def test_full_label_vocabulary(self):
        labeled = label_pivots(
            [
                pivot(0, 100, HIGH),  # High
                pivot(1, 90, LOW),    # Low
                pivot(2, 110, HIGH),  # HH  (110 > 100)
                pivot(3, 95, LOW),    # HL  (95 > 90)
                pivot(4, 105, HIGH),  # LH  (105 < 110)
                pivot(5, 85, LOW),    # LL  (85 < 95)
            ]
        )
        self.assertEqual(
            [p.label for p in labeled], ["High", "Low", "HH", "HL", "LH", "LL"]
        )

    def test_an_equal_high_is_a_lower_high(self):
        # It failed to make a new extreme, so it is not a continuation.
        labeled = label_pivots([pivot(0, 100, HIGH), pivot(1, 90, LOW), pivot(2, 100, HIGH)])
        self.assertEqual(labeled[2].label, "LH")

    def test_an_equal_low_is_a_lower_low(self):
        labeled = label_pivots([pivot(0, 90, LOW), pivot(1, 100, HIGH), pivot(2, 90, LOW)])
        self.assertEqual(labeled[2].label, "LL")


class TrendTests(unittest.TestCase):
    def test_higher_high_plus_higher_low_is_an_uptrend(self):
        labeled = label_pivots(
            [pivot(0, 100, HIGH), pivot(1, 90, LOW), pivot(2, 110, HIGH), pivot(3, 95, LOW)]
        )
        self.assertEqual(trend_from_labels(labeled), UPTREND)

    def test_lower_high_plus_lower_low_is_a_downtrend(self):
        labeled = label_pivots(
            [pivot(0, 100, HIGH), pivot(1, 90, LOW), pivot(2, 95, HIGH), pivot(3, 85, LOW)]
        )
        self.assertEqual(trend_from_labels(labeled), DOWNTREND)

    def test_mixed_labels_are_a_range(self):
        # HH but LL -- expanding, not trending.
        labeled = label_pivots(
            [pivot(0, 100, HIGH), pivot(1, 90, LOW), pivot(2, 110, HIGH), pivot(3, 85, LOW)]
        )
        self.assertEqual(trend_from_labels(labeled), RANGE)

    def test_too_few_pivots_is_a_range(self):
        self.assertEqual(trend_from_labels([]), RANGE)
        self.assertEqual(trend_from_labels(label_pivots([pivot(0, 100, HIGH)])), RANGE)


class AnalyzeTests(unittest.TestCase):
    def test_end_to_end_on_a_rising_zigzag(self):
        structure = analyze(series([100, 90, 100, 110, 100, 95, 100, 112, 105, 100, 118]), depth=1)
        labels = [p.label for p in structure.pivots]

        self.assertEqual(labels, ["Low", "High", "HL", "HH", "HL"])
        self.assertEqual(structure.trend, UPTREND)
        self.assertEqual(structure.last_high.label, "HH")
        self.assertEqual(structure.last_low.label, "HL")

    def test_structure_alternates_high_low_throughout(self):
        structure = analyze(
            series([100, 90, 105, 92, 108, 95, 103, 88, 99, 85, 96, 80, 92]), depth=1
        )
        kinds = [p.kind for p in structure.pivots]
        self.assertTrue(all(a != b for a, b in zip(kinds, kinds[1:])), kinds)

    def test_empty_input_gives_empty_structure(self):
        structure = build_structure([], min_swing_pct=0.0)
        self.assertEqual(structure.pivots, [])
        self.assertEqual(structure.trend, RANGE)
        self.assertIsNone(structure.last_high)


if __name__ == "__main__":
    unittest.main()
