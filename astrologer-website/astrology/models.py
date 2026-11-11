"""Database models for the consultancy: practitioners, services and bookings."""

from __future__ import annotations

import secrets
from datetime import date

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.urls import reverse
from django.utils import timezone

from . import zodiac

SIGN_CHOICES = [(sign.slug, sign.name) for sign in zodiac.SIGNS]


class Specialisation(models.Model):
    """A discipline a practitioner works in (Vedic, tarot, numerology, ...)."""

    name = models.CharField(max_length=60, unique=True)
    slug = models.SlugField(max_length=60, unique=True)
    description = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Astrologer(models.Model):
    """A practitioner available for consultations."""

    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=120, unique=True)
    headline = models.CharField(
        max_length=160, help_text="One-line summary shown on listing cards."
    )
    bio = models.TextField()
    specialisations = models.ManyToManyField(Specialisation, related_name="astrologers")
    languages = models.CharField(
        max_length=160, help_text="Comma-separated, e.g. 'English, Hindi, Tamil'."
    )
    years_experience = models.PositiveSmallIntegerField(
        validators=[MaxValueValidator(80)]
    )
    rate_per_minute = models.DecimalField(
        max_digits=7, decimal_places=2, help_text="Indicative rate in INR per minute."
    )
    rating = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=5,
        validators=[MinValueValidator(0), MaxValueValidator(5)],
    )
    consultations_done = models.PositiveIntegerField(default=0)
    photo_url = models.URLField(
        blank=True, help_text="Optional headshot. A monogram is shown when empty."
    )
    is_accepting_bookings = models.BooleanField(default=True)
    is_published = models.BooleanField(default=True)
    display_order = models.PositiveSmallIntegerField(
        default=100, help_text="Lower numbers are listed first."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("display_order", "name")

    def __str__(self) -> str:
        return self.name

    def get_absolute_url(self) -> str:
        return reverse("astrologer_detail", args=[self.slug])

    @property
    def language_list(self) -> list[str]:
        return [part.strip() for part in self.languages.split(",") if part.strip()]

    @property
    def initials(self) -> str:
        parts = [part for part in self.name.split() if part[:1].isalpha()]
        return "".join(part[0] for part in parts[:2]).upper() or "?"


class Service(models.Model):
    """A bookable consultation package."""

    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=120, unique=True)
    tagline = models.CharField(max_length=160)
    description = models.TextField()
    price = models.DecimalField(
        max_digits=9, decimal_places=2, help_text="Package price in INR."
    )
    duration_minutes = models.PositiveSmallIntegerField()
    icon = models.CharField(
        max_length=8, default="✦", help_text="A single emoji or glyph for the card."
    )
    requires_birth_details = models.BooleanField(
        default=True,
        help_text="Chart-based services need date, time and place of birth.",
    )
    is_published = models.BooleanField(default=True)
    display_order = models.PositiveSmallIntegerField(default=100)

    class Meta:
        ordering = ("display_order", "name")

    def __str__(self) -> str:
        return self.name

    def get_absolute_url(self) -> str:
        return reverse("service_detail", args=[self.slug])


class DailyHoroscope(models.Model):
    """An editor-written reading that overrides the generated one for a day."""

    sign = models.CharField(max_length=20, choices=SIGN_CHOICES)
    day = models.DateField(default=timezone.localdate)
    general = models.TextField()
    love = models.CharField(max_length=300)
    career = models.CharField(max_length=300)
    health = models.CharField(max_length=300)
    mood = models.CharField(max_length=40)
    lucky_number = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(99)]
    )
    lucky_colour = models.CharField(max_length=40)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="horoscopes",
    )

    class Meta:
        ordering = ("-day", "sign")
        constraints = [
            models.UniqueConstraint(
                fields=("sign", "day"), name="unique_horoscope_per_sign_per_day"
            )
        ]

    def __str__(self) -> str:
        return f"{self.get_sign_display()} — {self.day:%d %b %Y}"

    def as_reading(self) -> zodiac.Reading:
        """Adapt the stored row to the same shape as a generated reading."""
        return zodiac.Reading(
            sign=zodiac.SIGNS_BY_SLUG[self.sign],
            day=self.day,
            general=self.general,
            love=self.love,
            career=self.career,
            health=self.health,
            mood=self.mood,
            lucky_number=self.lucky_number,
            lucky_colour=self.lucky_colour,
            is_editorial=True,
        )


def reading_for(sign: zodiac.Sign, day: date) -> zodiac.Reading:
    """Return the editorial reading for ``sign`` on ``day``, else a generated one."""
    stored = DailyHoroscope.objects.filter(sign=sign.slug, day=day).first()
    if stored is not None:
        return stored.as_reading()
    return zodiac.generate_reading(sign, day)


def readings_for(signs, day: date) -> list[zodiac.Reading]:
    """Readings for many signs on one day, in one query."""
    overrides = {
        row.sign: row for row in DailyHoroscope.objects.filter(day=day)
    }
    return [
        overrides[sign.slug].as_reading()
        if sign.slug in overrides
        else zodiac.generate_reading(sign, day)
        for sign in signs
    ]


def readings_over_days(sign: zodiac.Sign, days) -> dict[date, zodiac.Reading]:
    """Readings for one sign across many days, in one query."""
    days = list(days)
    overrides = {
        row.day: row
        for row in DailyHoroscope.objects.filter(sign=sign.slug, day__in=days)
    }
    return {
        day: overrides[day].as_reading()
        if day in overrides
        else zodiac.generate_reading(sign, day)
        for day in days
    }


class Booking(models.Model):
    """A consultation request placed through the site."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending review"
        CONFIRMED = "confirmed", "Confirmed"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    class Mode(models.TextChoices):
        CALL = "call", "Phone call"
        VIDEO = "video", "Video call"
        CHAT = "chat", "Chat"

    reference = models.CharField(max_length=12, unique=True, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="bookings",
    )
    astrologer = models.ForeignKey(
        Astrologer, on_delete=models.PROTECT, related_name="bookings"
    )
    service = models.ForeignKey(
        Service, on_delete=models.PROTECT, related_name="bookings"
    )

    full_name = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)

    birth_date = models.DateField(null=True, blank=True)
    birth_time = models.TimeField(
        null=True, blank=True, help_text="As exact as known; affects the ascendant."
    )
    birth_place = models.CharField(max_length=160, blank=True)

    preferred_datetime = models.DateTimeField()
    mode = models.CharField(max_length=10, choices=Mode.choices, default=Mode.CALL)
    question = models.TextField(blank=True)

    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("status", "preferred_datetime")),
            models.Index(fields=("email",)),
        ]

    def __str__(self) -> str:
        return f"{self.reference} — {self.full_name} with {self.astrologer.name}"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = self._generate_reference()
        super().save(*args, **kwargs)

    @staticmethod
    def _generate_reference() -> str:
        """Produce an unused, human-quotable booking reference."""
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no look-alike characters
        for _ in range(20):
            candidate = "NK-" + "".join(secrets.choice(alphabet) for _ in range(6))
            if not Booking.objects.filter(reference=candidate).exists():
                return candidate
        raise RuntimeError("Could not allocate a unique booking reference.")

    def get_absolute_url(self) -> str:
        return reverse("booking_confirmation", args=[self.reference])

    @property
    def sun_sign(self) -> zodiac.Sign | None:
        """The client's sun sign, when they supplied a birth date."""
        if self.birth_date is None:
            return None
        return zodiac.sign_for_date(self.birth_date)

    @property
    def is_upcoming(self) -> bool:
        return (
            self.preferred_datetime >= timezone.now()
            and self.status in {self.Status.PENDING, self.Status.CONFIRMED}
        )


class Testimonial(models.Model):
    """A published client review shown on the home page."""

    client_name = models.CharField(max_length=80)
    location = models.CharField(max_length=80, blank=True)
    astrologer = models.ForeignKey(
        Astrologer,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="testimonials",
    )
    rating = models.PositiveSmallIntegerField(
        default=5, validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    quote = models.TextField(max_length=600)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.client_name} ({self.rating}★)"

    @property
    def stars(self) -> str:
        return "★" * self.rating + "☆" * (5 - self.rating)
