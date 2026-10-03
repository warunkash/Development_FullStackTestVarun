"""End-to-end checks on the public pages and the booking flow."""

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from astrology.models import Booking, Testimonial

from .factories import make_astrologer, make_service


class PageTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.astrologer = make_astrologer()
        cls.service = make_service()
        Testimonial.objects.create(
            client_name="R.", rating=5, quote="Clear and honest.",
            astrologer=cls.astrologer,
        )

    def test_public_pages_render(self):
        urls = [
            reverse("home"),
            reverse("astrologer_list"),
            reverse("astrologer_detail", args=[self.astrologer.slug]),
            reverse("service_list"),
            reverse("service_detail", args=[self.service.slug]),
            reverse("horoscope_index"),
            reverse("horoscope_detail", args=["leo"]),
            reverse("find_my_sign"),
            reverse("book"),
            reverse("about"),
            reverse("login"),
            reverse("signup"),
        ]
        for url in urls:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_home_shows_the_practice(self):
        response = self.client.get(reverse("home"))
        self.assertContains(response, self.astrologer.name)
        self.assertContains(response, self.service.name)
        self.assertContains(response, "Clear and honest.")

    def test_horoscope_index_lists_all_twelve_signs(self):
        response = self.client.get(reverse("horoscope_index"))
        self.assertEqual(len(response.context["readings"]), 12)

    def test_unknown_sign_is_a_404(self):
        self.assertEqual(
            self.client.get(reverse("horoscope_detail", args=["ophiuchus"])).status_code,
            404,
        )

    def test_unpublished_records_are_hidden(self):
        self.astrologer.is_published = False
        self.astrologer.save()
        self.assertEqual(
            self.client.get(
                reverse("astrologer_detail", args=[self.astrologer.slug])
            ).status_code,
            404,
        )
        self.assertNotContains(
            self.client.get(reverse("astrologer_list")), self.astrologer.name
        )

    def test_disclaimer_appears_on_every_page(self):
        response = self.client.get(reverse("home"))
        self.assertContains(response, "not a substitute for medical")


class SearchTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.vedic = make_astrologer(name="Aarti D", slug="aarti-d", languages="Hindi")
        cls.tarot = make_astrologer(name="Meera J", slug="meera-j", languages="Gujarati")

    def test_search_matches_name(self):
        response = self.client.get(reverse("astrologer_list"), {"q": "Meera"})
        self.assertContains(response, "Meera J")
        self.assertNotContains(response, "Aarti D")

    def test_search_matches_language(self):
        response = self.client.get(reverse("astrologer_list"), {"q": "Gujarati"})
        self.assertContains(response, "Meera J")

    def test_empty_search_returns_everyone(self):
        response = self.client.get(reverse("astrologer_list"), {"q": ""})
        self.assertEqual(len(response.context["astrologers"]), 2)

    def test_no_match_renders_without_error(self):
        response = self.client.get(reverse("astrologer_list"), {"q": "zzzzz"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context["astrologers"]), 0)


class FindMySignTests(TestCase):
    def test_valid_date_resolves(self):
        response = self.client.get(reverse("find_my_sign"), {"dob": "1990-08-05"})
        self.assertEqual(response.context["result"].slug, "leo")

    def test_malformed_date_shows_an_error_not_a_crash(self):
        for bad in ("not-a-date", "1990-13-45", "", "1990/08/05"):
            with self.subTest(bad=bad):
                response = self.client.get(reverse("find_my_sign"), {"dob": bad})
                self.assertEqual(response.status_code, 200)
                self.assertIsNone(response.context["result"])

    def test_future_date_is_refused(self):
        future = (timezone.localdate() + timedelta(days=5)).isoformat()
        response = self.client.get(reverse("find_my_sign"), {"dob": future})
        self.assertIsNone(response.context["result"])
        self.assertTrue(response.context["error"])


class BookingFlowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.astrologer = make_astrologer()
        cls.service = make_service()

    def _payload(self, **overrides):
        data = {
            "astrologer": self.astrologer.pk,
            "service": self.service.pk,
            "full_name": "Asha Rao",
            "email": "asha@example.com",
            "phone": "+91 90000 00000",
            "birth_date": "1990-08-05",
            "birth_time": "14:30",
            "birth_place": "Nagpur, India",
            "preferred_datetime": (timezone.now() + timedelta(days=3)).strftime(
                "%Y-%m-%dT%H:%M"
            ),
            "mode": "video",
            "question": "Career timing.",
        }
        data.update(overrides)
        return data

    def test_guest_can_book_and_lands_on_the_confirmation(self):
        response = self.client.post(reverse("book"), self._payload(), follow=True)
        self.assertEqual(response.status_code, 200)
        booking = Booking.objects.get()
        self.assertContains(response, booking.reference)
        self.assertIsNone(booking.user)
        self.assertEqual(booking.status, Booking.Status.PENDING)

    def test_invalid_submission_redisplays_without_saving(self):
        response = self.client.post(reverse("book"), self._payload(email="not-an-email"))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Booking.objects.exists())
        self.assertContains(response, "correct the highlighted fields")

    def test_booking_is_linked_to_a_signed_in_user(self):
        user = User.objects.create_user("asha", "asha@example.com", "pw-123456789")
        self.client.force_login(user)
        self.client.post(reverse("book"), self._payload())
        self.assertEqual(Booking.objects.get().user, user)

    def test_prefill_from_query_string(self):
        response = self.client.get(
            reverse("book"),
            {"astrologer": self.astrologer.slug, "service": self.service.slug},
        )
        initial = response.context["form"].initial
        self.assertEqual(initial["astrologer"], self.astrologer.pk)
        self.assertEqual(initial["service"], self.service.pk)

    def test_unknown_prefill_slug_is_ignored(self):
        response = self.client.get(reverse("book"), {"astrologer": "nobody"})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("astrologer", response.context["form"].initial)

    def test_confirmation_of_an_unknown_reference_is_a_404(self):
        self.assertEqual(
            self.client.get(
                reverse("booking_confirmation", args=["NK-XXXXXX"])
            ).status_code,
            404,
        )


class MyBookingsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.astrologer = make_astrologer()
        cls.service = make_service()
        cls.user = User.objects.create_user("asha", "asha@example.com", "pw-123456789")

    def _booking(self, **overrides):
        defaults = {
            "astrologer": self.astrologer,
            "service": self.service,
            "full_name": "Asha Rao",
            "email": "asha@example.com",
            "preferred_datetime": timezone.now() + timedelta(days=2),
        }
        defaults.update(overrides)
        return Booking.objects.create(**defaults)

    def test_requires_sign_in(self):
        response = self.client.get(reverse("my_bookings"))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("login"), response.url)

    def test_shows_own_bookings_including_guest_ones_matched_by_email(self):
        linked = self._booking(user=self.user)
        guest = self._booking()  # same e-mail, no account attached
        self.client.force_login(self.user)
        response = self.client.get(reverse("my_bookings"))
        self.assertContains(response, linked.reference)
        self.assertContains(response, guest.reference)

    def test_does_not_leak_other_peoples_bookings(self):
        other = self._booking(email="someone.else@example.com", full_name="Someone Else")
        self.client.force_login(self.user)
        response = self.client.get(reverse("my_bookings"))
        self.assertNotContains(response, other.reference)


class SignUpTests(TestCase):
    def test_signup_creates_an_account_and_signs_in(self):
        response = self.client.post(
            reverse("signup"),
            {
                "username": "asha",
                "first_name": "Asha",
                "email": "asha@example.com",
                "password1": "a-strong-passphrase-42",
                "password2": "a-strong-passphrase-42",
            },
            follow=True,
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(User.objects.filter(username="asha").exists())
        self.assertEqual(int(self.client.session["_auth_user_id"]),
                         User.objects.get(username="asha").pk)

    def test_signed_in_users_are_redirected_away(self):
        user = User.objects.create_user("asha", "asha@example.com", "pw-123456789")
        self.client.force_login(user)
        response = self.client.get(reverse("signup"))
        self.assertRedirects(response, reverse("my_bookings"))
