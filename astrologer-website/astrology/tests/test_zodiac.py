"""Unit tests for the pure zodiac / horoscope logic."""

from datetime import date, timedelta

from django.test import SimpleTestCase

from astrology import zodiac


class SignForDateTests(SimpleTestCase):
    def test_every_day_of_the_year_maps_to_a_sign(self):
        """No gaps: a leap year's 366 days all resolve."""
        day = date(2024, 1, 1)
        seen = set()
        while day.year == 2024:
            sign = zodiac.sign_for_date(day)
            self.assertIsNotNone(sign, f"{day} produced no sign")
            seen.add(sign.slug)
            day = date.fromordinal(day.toordinal() + 1)
        self.assertEqual(len(seen), 12, "every sign should occur across a full year")

    def test_band_boundaries(self):
        cases = [
            (date(2025, 3, 21), "aries"),
            (date(2025, 4, 19), "aries"),
            (date(2025, 4, 20), "taurus"),
            (date(2025, 7, 22), "cancer"),
            (date(2025, 7, 23), "leo"),
            (date(2025, 11, 21), "scorpio"),
            (date(2025, 11, 22), "sagittarius"),
        ]
        for value, expected in cases:
            with self.subTest(value=value):
                self.assertEqual(zodiac.sign_for_date(value).slug, expected)

    def test_capricorn_wraps_across_the_new_year(self):
        """The only band that spans a year boundary."""
        for value in (date(2025, 12, 22), date(2025, 12, 31), date(2026, 1, 1), date(2026, 1, 19)):
            with self.subTest(value=value):
                self.assertEqual(zodiac.sign_for_date(value).slug, "capricorn")

        self.assertEqual(zodiac.sign_for_date(date(2025, 12, 21)).slug, "sagittarius")
        self.assertEqual(zodiac.sign_for_date(date(2026, 1, 20)).slug, "aquarius")

    def test_leap_day_resolves_to_pisces(self):
        self.assertEqual(zodiac.sign_for_date(date(2024, 2, 29)).slug, "pisces")

    def test_get_sign_is_case_insensitive_and_safe(self):
        self.assertEqual(zodiac.get_sign("LEO").slug, "leo")
        self.assertEqual(zodiac.get_sign("  libra  ").slug, "libra")
        self.assertIsNone(zodiac.get_sign("ophiuchus"))
        self.assertIsNone(zodiac.get_sign(""))
        self.assertIsNone(zodiac.get_sign(None))


class SignDataTests(SimpleTestCase):
    def test_twelve_signs_with_unique_slugs(self):
        self.assertEqual(len(zodiac.SIGNS), 12)
        self.assertEqual(len({sign.slug for sign in zodiac.SIGNS}), 12)

    def test_each_element_has_three_signs(self):
        for element in (zodiac.FIRE, zodiac.EARTH, zodiac.AIR, zodiac.WATER):
            with self.subTest(element=element):
                count = sum(1 for sign in zodiac.SIGNS if sign.element == element)
                self.assertEqual(count, 3)

    def test_each_modality_has_four_signs(self):
        for modality in (zodiac.CARDINAL, zodiac.FIXED, zodiac.MUTABLE):
            with self.subTest(modality=modality):
                count = sum(1 for sign in zodiac.SIGNS if sign.modality == modality)
                self.assertEqual(count, 4)

    def test_date_range_is_human_readable(self):
        self.assertEqual(zodiac.SIGNS_BY_SLUG["aries"].date_range, "March 21 – April 19")


class ReadingTests(SimpleTestCase):
    def test_reading_is_deterministic(self):
        sign = zodiac.SIGNS_BY_SLUG["virgo"]
        day = date(2026, 9, 13)
        first = zodiac.generate_reading(sign, day)
        second = zodiac.generate_reading(sign, day)
        self.assertEqual(first, second)

    def test_reading_varies_by_day_and_by_sign(self):
        sign = zodiac.SIGNS_BY_SLUG["virgo"]
        today = zodiac.generate_reading(sign, date(2026, 9, 13))
        tomorrow = zodiac.generate_reading(sign, date(2026, 9, 14))
        other_sign = zodiac.generate_reading(
            zodiac.SIGNS_BY_SLUG["leo"], date(2026, 9, 13)
        )
        self.assertNotEqual(today.general, tomorrow.general)
        self.assertNotEqual(today.general, other_sign.general)

    def test_reading_fields_are_populated_and_in_range(self):
        for sign in zodiac.SIGNS:
            with self.subTest(sign=sign.slug):
                reading = zodiac.generate_reading(sign, date(2026, 9, 13))
                for field in (reading.general, reading.love, reading.career,
                              reading.health, reading.mood, reading.lucky_colour):
                    self.assertTrue(field.strip())
                self.assertIn(reading.lucky_number, range(1, 10))
                self.assertFalse(reading.is_editorial)

    def test_generated_readings_spread_across_the_available_copy(self):
        """A weak seed would collapse every sign onto the same line."""
        day = date(2026, 9, 13)
        openers = {zodiac.generate_reading(s, day).general for s in zodiac.SIGNS}
        self.assertGreaterEqual(len(openers), 6)

    def test_every_opener_and_closer_combination_is_reachable(self):
        """Deriving each slot from its own digest window keeps the pools in play.

        An earlier version divided one integer seed by powers of 31, which made
        the sections move together and left most combinations unreachable.
        """
        start = date(2026, 1, 1)
        seen = {
            zodiac.generate_reading(sign, start + timedelta(days=offset)).general
            for sign in zodiac.SIGNS
            for offset in range(365)
        }
        expected = len(zodiac.GENERAL_OPENERS) * len(zodiac.GENERAL_CLOSERS)
        self.assertEqual(len(seen), expected)

    def test_sections_vary_independently_of_each_other(self):
        """Love and career must not be locked in step with the general reading."""
        start = date(2026, 1, 1)
        pairs = {
            (r.general, r.love)
            for r in (
                zodiac.generate_reading(zodiac.SIGNS_BY_SLUG["leo"], start + timedelta(days=d))
                for d in range(200)
            )
        }
        generals = {pair[0] for pair in pairs}
        self.assertGreater(len(pairs), len(generals))

    def test_lucky_numbers_cover_the_full_range(self):
        start = date(2026, 1, 1)
        numbers = {
            zodiac.generate_reading(sign, start + timedelta(days=offset)).lucky_number
            for sign in zodiac.SIGNS
            for offset in range(90)
        }
        self.assertEqual(numbers, set(range(1, 10)))


class CompatibilityTests(SimpleTestCase):
    def test_scores_stay_within_bounds(self):
        for first in zodiac.SIGNS:
            for second in zodiac.SIGNS:
                score = zodiac.compatibility_score(first, second)
                self.assertGreaterEqual(score, 0)
                self.assertLessEqual(score, 100)

    def test_symmetric(self):
        aries = zodiac.SIGNS_BY_SLUG["aries"]
        libra = zodiac.SIGNS_BY_SLUG["libra"]
        self.assertEqual(
            zodiac.compatibility_score(aries, libra),
            zodiac.compatibility_score(libra, aries),
        )

    def test_same_element_beats_clashing_element(self):
        aries = zodiac.SIGNS_BY_SLUG["aries"]  # fire, cardinal
        sagittarius = zodiac.SIGNS_BY_SLUG["sagittarius"]  # fire, mutable
        virgo = zodiac.SIGNS_BY_SLUG["virgo"]  # earth, mutable
        self.assertGreater(
            zodiac.compatibility_score(aries, sagittarius),
            zodiac.compatibility_score(aries, virgo),
        )

    def test_shared_modality_reduces_the_score(self):
        """Aries and Cancer are both cardinal — the classic square."""
        aries = zodiac.SIGNS_BY_SLUG["aries"]
        cancer = zodiac.SIGNS_BY_SLUG["cancer"]  # water, cardinal
        pisces = zodiac.SIGNS_BY_SLUG["pisces"]  # water, mutable
        self.assertLess(
            zodiac.compatibility_score(aries, cancer),
            zodiac.compatibility_score(aries, pisces),
        )
