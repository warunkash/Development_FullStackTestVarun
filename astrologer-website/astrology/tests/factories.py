"""Small helpers so each test builds only the objects it needs."""

from decimal import Decimal

from astrology.models import Astrologer, Service, Specialisation


def make_astrologer(**overrides):
    defaults = {
        "name": "Test Reader",
        "slug": "test-reader",
        "headline": "Reads charts for testing purposes",
        "bio": "A fixture.",
        "languages": "English, Hindi",
        "years_experience": 10,
        "rate_per_minute": Decimal("30.00"),
        "rating": Decimal("4.50"),
    }
    defaults.update(overrides)
    astrologer = Astrologer.objects.create(**defaults)
    spec, _ = Specialisation.objects.get_or_create(
        slug="vedic-astrology", defaults={"name": "Vedic astrology"}
    )
    astrologer.specialisations.add(spec)
    return astrologer


def make_service(**overrides):
    defaults = {
        "name": "Test Reading",
        "slug": "test-reading",
        "tagline": "A fixture service.",
        "description": "Body copy.",
        "price": Decimal("1000.00"),
        "duration_minutes": 45,
        "requires_birth_details": True,
    }
    defaults.update(overrides)
    return Service.objects.create(**defaults)
