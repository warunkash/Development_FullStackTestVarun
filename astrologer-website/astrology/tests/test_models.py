"""Model-level behaviour: references, sun signs and editorial overrides."""

from datetime import date, timedelta
from decimal import Decimal

from django.db.utils import IntegrityError
from django.test import TestCase
from django.utils import timezone

from astrology import zodiac
from astrology.models import Booking, DailyHoroscope, Testimonial, reading_for

from .factories import make_astrologer, make_service


class BookingReferenceTests(TestCase):
    def setUp(self):
        self.astrologer = make_astrologer()
        self.service = make_service()

    def _booking(self, **overrides):
        defaults = {
            "astrologer": self.astrologer,
            "service": self.service,
            "full_name": "Asha Rao",
            "email": "asha@example.com",
            "phone": "+91 90000 00000",
            "preferred_datetime": timezone.now() + timedelta(days=2),
        }
        defaults.update(overrides)
        return Booking.objects.create(**defaults)

    def test_reference_is_assigned_and_well_formed(self):
        booking = self._booking()
        self.assertTrue(booking.reference.startswith("NK-"))
        self.assertEqual(len(booking.reference), 9)

    def test_reference_avoids_look_alike_characters(self):
        """0/O and 1/I are excluded so a reference can be read over the phone."""
        for _ in range(25):
            reference = self._booking().reference
            self.assertFalse(set(reference[3:]) & set("01OI"), reference)

    def test_references_are_unique_across_many_bookings(self):
        references = {self._booking().reference for _ in range(40)}
        self.assertEqual(len(references), 40)

    def test_reference_is_stable_across_saves(self):
        booking = self._booking()
        original = booking.reference
        booking.status = Booking.Status.CONFIRMED
        booking.save()
        booking.refresh_from_db()
        self.assertEqual(booking.reference, original)

    def test_sun_sign_derives_from_birth_date(self):
        booking = self._booking(birth_date=date(1990, 8, 5))
        self.assertEqual(booking.sun_sign.slug, "leo")

    def test_sun_sign_is_none_without_a_birth_date(self):
        self.assertIsNone(self._booking().sun_sign)

    def test_is_upcoming_reflects_time_and_status(self):
        future = self._booking()
        self.assertTrue(future.is_upcoming)

        past = self._booking(preferred_datetime=timezone.now() - timedelta(days=1))
        self.assertFalse(past.is_upcoming)

        cancelled = self._booking(status=Booking.Status.CANCELLED)
        self.assertFalse(cancelled.is_upcoming)


class DailyHoroscopeTests(TestCase):
    def test_editorial_row_overrides_the_generated_reading(self):
        day = date(2026, 9, 13)
        DailyHoroscope.objects.create(
            sign="leo",
            day=day,
            general="A hand-written reading from the desk.",
            love="Editorial love line.",
            career="Editorial career line.",
            health="Editorial health line.",
            mood="Bright",
            lucky_number=7,
            lucky_colour="Saffron",
        )
        reading = reading_for(zodiac.SIGNS_BY_SLUG["leo"], day)
        self.assertTrue(reading.is_editorial)
        self.assertEqual(reading.general, "A hand-written reading from the desk.")

    def test_generated_reading_is_used_when_no_row_exists(self):
        reading = reading_for(zodiac.SIGNS_BY_SLUG["leo"], date(2026, 9, 13))
        self.assertFalse(reading.is_editorial)
        self.assertTrue(reading.general)

    def test_an_override_only_applies_to_its_own_sign_and_day(self):
        day = date(2026, 9, 13)
        DailyHoroscope.objects.create(
            sign="leo", day=day, general="Leo only.", love="l", career="c",
            health="h", mood="Bright", lucky_number=7, lucky_colour="Saffron",
        )
        other_sign = reading_for(zodiac.SIGNS_BY_SLUG["virgo"], day)
        next_day = reading_for(zodiac.SIGNS_BY_SLUG["leo"], day + timedelta(days=1))
        self.assertFalse(other_sign.is_editorial)
        self.assertFalse(next_day.is_editorial)

    def test_one_editorial_reading_per_sign_per_day(self):
        fields = dict(
            general="g", love="l", career="c", health="h",
            mood="Bright", lucky_number=7, lucky_colour="Saffron",
        )
        DailyHoroscope.objects.create(sign="aries", day=date(2026, 9, 13), **fields)
        with self.assertRaises(IntegrityError):
            DailyHoroscope.objects.create(sign="aries", day=date(2026, 9, 13), **fields)


class PresentationTests(TestCase):
    def test_initials_fall_back_gracefully(self):
        self.assertEqual(make_astrologer(name="Aarti Deshmukh", slug="a-d").initials, "AD")
        self.assertEqual(make_astrologer(name="Meera", slug="m").initials, "M")

    def test_language_list_is_split_and_trimmed(self):
        astrologer = make_astrologer(languages="English,  Hindi , Tamil")
        self.assertEqual(astrologer.language_list, ["English", "Hindi", "Tamil"])

    def test_testimonial_stars_render_out_of_five(self):
        testimonial = Testimonial.objects.create(
            client_name="R.", rating=4, quote="Helpful session."
        )
        self.assertEqual(testimonial.stars, "★★★★☆")

    def test_service_price_precision_is_preserved(self):
        service = make_service(price=Decimal("2499.50"), slug="precise")
        service.refresh_from_db()
        self.assertEqual(service.price, Decimal("2499.50"))
