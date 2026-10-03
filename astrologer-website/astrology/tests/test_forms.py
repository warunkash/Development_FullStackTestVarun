"""Validation rules on the booking form."""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from astrology.forms import BookingForm, SignUpForm
from django.contrib.auth.models import User

from .factories import make_astrologer, make_service


class BookingFormTests(TestCase):
    def setUp(self):
        self.astrologer = make_astrologer()
        self.chart_service = make_service(requires_birth_details=True)
        self.tarot_service = make_service(
            name="Tarot", slug="tarot", requires_birth_details=False
        )

    def _payload(self, **overrides):
        data = {
            "astrologer": self.astrologer.pk,
            "service": self.chart_service.pk,
            "full_name": "Asha Rao",
            "email": "asha@example.com",
            "phone": "+91 90000 00000",
            "birth_date": "1990-08-05",
            "birth_time": "14:30",
            "birth_place": "Nagpur, India",
            "preferred_datetime": (timezone.now() + timedelta(days=3)).strftime(
                "%Y-%m-%dT%H:%M"
            ),
            "mode": "call",
            "question": "Career timing.",
        }
        data.update(overrides)
        return data

    def test_valid_payload_is_accepted(self):
        form = BookingForm(data=self._payload())
        self.assertTrue(form.is_valid(), form.errors.as_json())

    def test_past_appointments_are_rejected(self):
        form = BookingForm(
            data=self._payload(
                preferred_datetime=(timezone.now() - timedelta(days=1)).strftime(
                    "%Y-%m-%dT%H:%M"
                )
            )
        )
        self.assertFalse(form.is_valid())
        self.assertIn("preferred_datetime", form.errors)

    def test_future_birth_date_is_rejected(self):
        future = (timezone.localdate() + timedelta(days=1)).isoformat()
        form = BookingForm(data=self._payload(birth_date=future))
        self.assertFalse(form.is_valid())
        self.assertIn("birth_date", form.errors)

    def test_chart_service_requires_birth_details(self):
        form = BookingForm(data=self._payload(birth_date="", birth_place=""))
        self.assertFalse(form.is_valid())
        self.assertIn("birth_date", form.errors)
        self.assertIn("birth_place", form.errors)

    def test_non_chart_service_does_not_require_birth_details(self):
        form = BookingForm(
            data=self._payload(
                service=self.tarot_service.pk, birth_date="", birth_time="", birth_place=""
            )
        )
        self.assertTrue(form.is_valid(), form.errors.as_json())

    def test_phone_is_required(self):
        form = BookingForm(data=self._payload(phone=""))
        self.assertFalse(form.is_valid())
        self.assertIn("phone", form.errors)

    def test_astrologer_not_taking_bookings_is_excluded(self):
        self.astrologer.is_accepting_bookings = False
        self.astrologer.save()
        form = BookingForm(data=self._payload())
        self.assertFalse(form.is_valid())
        self.assertIn("astrologer", form.errors)

    def test_unpublished_astrologers_are_not_selectable(self):
        hidden = make_astrologer(name="Hidden", slug="hidden", is_published=False)
        form = BookingForm()
        self.assertNotIn(hidden, form.fields["astrologer"].queryset)


class SignUpFormTests(TestCase):
    def _payload(self, **overrides):
        data = {
            "username": "asha",
            "first_name": "Asha",
            "email": "asha@example.com",
            "password1": "a-strong-passphrase-42",
            "password2": "a-strong-passphrase-42",
        }
        data.update(overrides)
        return data

    def test_creates_a_user_with_email_and_first_name(self):
        form = SignUpForm(data=self._payload())
        self.assertTrue(form.is_valid(), form.errors.as_json())
        user = form.save()
        self.assertEqual(user.email, "asha@example.com")
        self.assertEqual(user.first_name, "Asha")

    def test_duplicate_email_is_rejected_case_insensitively(self):
        User.objects.create_user("existing", "Asha@Example.com", "pw-123456789")
        form = SignUpForm(data=self._payload(username="another"))
        self.assertFalse(form.is_valid())
        self.assertIn("email", form.errors)
