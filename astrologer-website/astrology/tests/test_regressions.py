"""Regressions for defects found in review of the initial implementation."""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from astrology import zodiac
from astrology.models import Booking, DailyHoroscope, readings_for, readings_over_days
from astrology.templatetags.astro_extras import rupees, stars

from .factories import make_astrologer, make_service


class FindMySignRobustnessTests(TestCase):
    def test_absurd_year_is_rejected_not_a_500(self):
        """date() raises OverflowError, not ValueError, for a huge year."""
        response = self.client.get(
            reverse("find_my_sign"), {"dob": "99999999999999999999-1-1"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.context["result"])
        self.assertTrue(response.context["error"])

    def test_other_malformed_dates_still_handled(self):
        for bad in ("1990-02-30", "----", "1990-1", "9-9-9-9"):
            with self.subTest(bad=bad):
                response = self.client.get(reverse("find_my_sign"), {"dob": bad})
                self.assertEqual(response.status_code, 200)
                self.assertIsNone(response.context["result"])


class BookingPrivacyTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.astrologer = make_astrologer()
        cls.service = make_service()

    def _booking(self, **overrides):
        defaults = {
            "astrologer": self.astrologer,
            "service": self.service,
            "full_name": "Asha Rao",
            "email": "asha@example.com",
            "preferred_datetime": timezone.now() + timedelta(days=2),
            "question": "A private question.",
        }
        defaults.update(overrides)
        return Booking.objects.create(**defaults)

    def test_my_bookings_ignores_unverified_email_matches(self):
        """Sign-up does not verify e-mail, so it must not grant access."""
        guest = self._booking()
        impostor = User.objects.create_user(
            "impostor", "asha@example.com", "pw-123456789"
        )
        self.client.force_login(impostor)
        response = self.client.get(reverse("my_bookings"))
        self.assertNotContains(response, guest.reference)

    def test_my_bookings_shows_bookings_attached_to_the_account(self):
        owner = User.objects.create_user("asha", "asha@example.com", "pw-123456789")
        mine = self._booking(user=owner)
        self.client.force_login(owner)
        self.assertContains(self.client.get(reverse("my_bookings")), mine.reference)

    def test_guest_booking_stays_reachable_by_reference(self):
        guest = self._booking()
        response = self.client.get(guest.get_absolute_url())
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, guest.reference)

    def test_owned_booking_is_not_readable_by_reference_alone(self):
        owner = User.objects.create_user("asha", "asha@example.com", "pw-123456789")
        owned = self._booking(user=owner)
        self.assertEqual(self.client.get(owned.get_absolute_url()).status_code, 404)

        other = User.objects.create_user("bob", "bob@example.com", "pw-123456789")
        self.client.force_login(other)
        self.assertEqual(self.client.get(owned.get_absolute_url()).status_code, 404)

        self.client.force_login(owner)
        self.assertEqual(self.client.get(owned.get_absolute_url()).status_code, 200)

    def test_staff_may_open_an_owned_booking(self):
        owner = User.objects.create_user("asha", "asha@example.com", "pw-123456789")
        owned = self._booking(user=owner)
        staff = User.objects.create_user(
            "desk", "desk@example.com", "pw-123456789", is_staff=True
        )
        self.client.force_login(staff)
        self.assertEqual(self.client.get(owned.get_absolute_url()).status_code, 200)


class HoroscopeDayTests(TestCase):
    def test_day_defaults_to_the_site_timezone(self):
        """date.today() follows the OS clock; readers use localdate()."""
        row = DailyHoroscope.objects.create(
            sign="leo", general="g", love="l", career="c", health="h",
            mood="Bright", lucky_number=7, lucky_colour="Saffron",
        )
        self.assertEqual(row.day, timezone.localdate())

    def test_batch_readers_match_single_lookups(self):
        day = timezone.localdate()
        DailyHoroscope.objects.create(
            sign="leo", day=day, general="Editorial leo.", love="l", career="c",
            health="h", mood="Bright", lucky_number=7, lucky_colour="Saffron",
        )
        batch = readings_for(zodiac.SIGNS, day)
        self.assertEqual(len(batch), 12)
        leo = next(r for r in batch if r.sign.slug == "leo")
        self.assertTrue(leo.is_editorial)
        self.assertEqual(leo.general, "Editorial leo.")
        virgo = next(r for r in batch if r.sign.slug == "virgo")
        self.assertFalse(virgo.is_editorial)

    def test_batch_readers_use_one_query(self):
        day = timezone.localdate()
        with self.assertNumQueries(1):
            readings_for(zodiac.SIGNS, day)
        with self.assertNumQueries(1):
            readings_over_days(
                zodiac.SIGNS_BY_SLUG["leo"], [day + timedelta(days=i) for i in range(4)]
            )

    def test_horoscope_pages_do_not_scale_queries_with_signs(self):
        with self.assertNumQueries(1):
            self.client.get(reverse("horoscope_index"))

    def test_readings_over_days_covers_every_requested_day(self):
        sign = zodiac.SIGNS_BY_SLUG["leo"]
        days = [date(2026, 9, 20) + timedelta(days=i) for i in range(4)]
        self.assertEqual(sorted(readings_over_days(sign, days)), days)


class FilterTests(TestCase):
    def test_stars_round_half_up(self):
        """round() is half-to-even, which showed 4.5 and 3.5 identically."""
        self.assertEqual(stars(Decimal("4.5")), "★★★★★")
        self.assertEqual(stars(Decimal("3.5")), "★★★★☆")
        self.assertEqual(stars(Decimal("4.49")), "★★★★☆")

    def test_stars_clamp_and_degrade(self):
        self.assertEqual(stars(9), "★★★★★")
        self.assertEqual(stars(-1), "☆☆☆☆☆")
        self.assertEqual(stars("not a number"), "")

    def test_rupees_uses_indian_grouping(self):
        self.assertEqual(rupees(Decimal("1000")), "₹1,000")
        self.assertEqual(rupees(Decimal("100000")), "₹1,00,000")
        self.assertEqual(rupees(Decimal("10000000")), "₹1,00,00,000")
        self.assertEqual(rupees(Decimal("2500")), "₹2,500")

    def test_rupees_keeps_paise_only_when_present(self):
        self.assertEqual(rupees(Decimal("1200.50")), "₹1,200.50")
        self.assertEqual(rupees(Decimal("1200.00")), "₹1,200")

    def test_rupees_degrades_on_junk(self):
        self.assertEqual(rupees("not a number"), "not a number")
        self.assertEqual(rupees(None), None)


class AstrologerCtaTests(TestCase):
    def test_cta_keeps_the_first_name_intact(self):
        """cut:" " stripped every space, rendering 'Book with AartiDeshmukh'."""
        astrologer = make_astrologer(name="Aarti Deshmukh", slug="aarti-deshmukh")
        response = self.client.get(astrologer.get_absolute_url())
        self.assertContains(response, "Book with Aarti")
        self.assertNotContains(response, "AartiDeshmukh")
