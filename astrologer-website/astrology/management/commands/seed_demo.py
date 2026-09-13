"""Populate the database with a realistic demo practice.

Run with ``python manage.py seed_demo``. The command is idempotent: it keys off
slugs and natural keys, so running it twice will not duplicate rows.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from astrology.models import (
    Astrologer,
    Booking,
    Service,
    Specialisation,
    Testimonial,
)

SPECIALISATIONS = [
    ("Vedic astrology", "vedic-astrology", "Parashari chart reading and dasha analysis."),
    ("Kundli matching", "kundli-matching", "Guna milan and compatibility review."),
    ("Numerology", "numerology", "Name and birth-number analysis."),
    ("Tarot", "tarot", "Card-led readings for specific questions."),
    ("Vastu", "vastu", "Placement and direction guidance for homes and offices."),
    ("Palmistry", "palmistry", "Hand reading for temperament and timing."),
]

ASTROLOGERS = [
    {
        "name": "Aarti Deshmukh",
        "slug": "aarti-deshmukh",
        "headline": "Vedic chart reading with a focus on career timing",
        "bio": (
            "Aarti has read charts professionally for eighteen years, working mostly "
            "with people at a crossroads in their working life. Her approach is "
            "Parashari at its base, and she is careful to separate what a chart "
            "genuinely indicates from what the client hopes it will say. Sessions "
            "are practical and she will always tell you when a question is better "
            "answered by a lawyer, a doctor or an accountant than by an astrologer."
        ),
        "languages": "English, Hindi, Marathi",
        "years_experience": 18,
        "rate_per_minute": Decimal("45.00"),
        "rating": Decimal("4.90"),
        "consultations_done": 6400,
        "display_order": 10,
        "specialisations": ["vedic-astrology", "kundli-matching"],
    },
    {
        "name": "Ravi Krishnan",
        "slug": "ravi-krishnan",
        "headline": "Kundli matching and family consultations",
        "bio": (
            "Ravi comes from a family of practitioners in Thanjavur and has been "
            "reading charts since 2009. Most of his work is matching and family "
            "consultation, and he is known for handling difficult conversations "
            "with tact. He is direct about the limits of guna milan and encourages "
            "couples to treat a reading as one input among several."
        ),
        "languages": "English, Tamil, Malayalam",
        "years_experience": 16,
        "rate_per_minute": Decimal("38.00"),
        "rating": Decimal("4.80"),
        "consultations_done": 5100,
        "display_order": 20,
        "specialisations": ["kundli-matching", "vedic-astrology", "palmistry"],
    },
    {
        "name": "Meera Joshi",
        "slug": "meera-joshi",
        "headline": "Tarot and numerology for focused, single-question readings",
        "bio": (
            "Meera works best when there is one clear question on the table. She "
            "combines tarot with numerology and keeps her sessions short and "
            "specific — thirty minutes is usually enough. Clients tend to come back "
            "to her at decision points rather than for regular readings."
        ),
        "languages": "English, Hindi, Gujarati",
        "years_experience": 11,
        "rate_per_minute": Decimal("32.00"),
        "rating": Decimal("4.70"),
        "consultations_done": 3800,
        "display_order": 30,
        "specialisations": ["tarot", "numerology"],
    },
    {
        "name": "Sanjay Rao",
        "slug": "sanjay-rao",
        "headline": "Vastu for homes, offices and new construction",
        "bio": (
            "Sanjay trained as a civil engineer before taking up Vastu full time, "
            "and it shows — his recommendations tend to be buildable rather than "
            "theoretical. He works from floor plans and will say plainly when a "
            "suggested change is not worth the cost of making it."
        ),
        "languages": "English, Kannada, Telugu, Hindi",
        "years_experience": 14,
        "rate_per_minute": Decimal("40.00"),
        "rating": Decimal("4.85"),
        "consultations_done": 2900,
        "display_order": 40,
        "specialisations": ["vastu", "vedic-astrology"],
    },
]

SERVICES = [
    {
        "name": "Birth chart reading",
        "slug": "birth-chart-reading",
        "tagline": "A full read of your janma kundli, start to finish.",
        "description": (
            "The foundational session. We cast your chart from your date, time and "
            "place of birth, then work through the houses, the current dasha period "
            "and the planetary transits that matter over the next twelve months. "
            "You will get a recording and a written summary afterwards.\n\n"
            "Bring your birth time as precisely as you can find it — the ascendant "
            "shifts roughly every two hours, and it changes a great deal of the read."
        ),
        "price": Decimal("2500.00"),
        "duration_minutes": 60,
        "icon": "🪐",
        "requires_birth_details": True,
        "display_order": 10,
    },
    {
        "name": "Kundli matching",
        "slug": "kundli-matching",
        "tagline": "Compatibility review for two charts, read together.",
        "description": (
            "Guna milan across the eight koota, plus a review of manglik dosha and "
            "the seventh house in both charts. We go beyond the score: a number out "
            "of thirty-six tells you very little on its own, so the session focuses "
            "on where the two charts genuinely support each other and where they "
            "will need deliberate effort.\n\n"
            "Both sets of birth details are needed. Couples are welcome to join together."
        ),
        "price": Decimal("3200.00"),
        "duration_minutes": 75,
        "icon": "💞",
        "requires_birth_details": True,
        "display_order": 20,
    },
    {
        "name": "Career and finance reading",
        "slug": "career-and-finance-reading",
        "tagline": "Timing questions about work, money and change.",
        "description": (
            "For people weighing a move, a business, a relocation or a long pause. "
            "We look at the tenth and eleventh houses, the running dasha and the "
            "Saturn and Jupiter transits that tend to set the pace of working life.\n\n"
            "This is a reflective session, not financial advice. We will talk about "
            "timing and temperament, not about specific investments."
        ),
        "price": Decimal("2200.00"),
        "duration_minutes": 45,
        "icon": "📈",
        "requires_birth_details": True,
        "display_order": 30,
    },
    {
        "name": "Single-question tarot",
        "slug": "single-question-tarot",
        "tagline": "One question, thirty focused minutes.",
        "description": (
            "A short, specific reading for when there is one decision in front of "
            "you. No birth details needed — come with the question phrased as "
            "clearly as you can manage, which is usually half the work.\n\n"
            "Best for immediate choices rather than long-horizon questions."
        ),
        "price": Decimal("1200.00"),
        "duration_minutes": 30,
        "icon": "🔮",
        "requires_birth_details": False,
        "display_order": 40,
    },
    {
        "name": "Vastu consultation",
        "slug": "vastu-consultation",
        "tagline": "Direction and placement guidance from your floor plan.",
        "description": (
            "Share a floor plan ahead of the session and we will work through "
            "entrance, kitchen, bedroom and workspace placement, with an emphasis "
            "on changes that are actually practical to make.\n\n"
            "Useful before a move, a renovation or a new build."
        ),
        "price": Decimal("4000.00"),
        "duration_minutes": 90,
        "icon": "🏠",
        "requires_birth_details": False,
        "display_order": 50,
    },
    {
        "name": "Numerology profile",
        "slug": "numerology-profile",
        "tagline": "Your birth number, name number and the year ahead.",
        "description": (
            "A compact session covering your driver and conductor numbers, the "
            "numerology of your name as you currently write it, and the personal "
            "year you are in.\n\n"
            "Frequently booked alongside a birth chart reading rather than on its own."
        ),
        "price": Decimal("1500.00"),
        "duration_minutes": 40,
        "icon": "🔢",
        "requires_birth_details": True,
        "display_order": 60,
    },
]

TESTIMONIALS = [
    {
        "client_name": "Priya N.",
        "location": "Bengaluru",
        "astrologer": "aarti-deshmukh",
        "rating": 5,
        "quote": (
            "I went in expecting reassurance and got something more useful — a frank "
            "read on why the last two years felt stuck, and what the next eighteen "
            "months actually look like. Aarti did not tell me what I wanted to hear."
        ),
    },
    {
        "client_name": "Arun and Divya",
        "location": "Chennai",
        "astrologer": "ravi-krishnan",
        "rating": 5,
        "quote": (
            "Our families were anxious about the match and the guna score had become "
            "a sticking point. Ravi walked both sets of parents through what the "
            "score does and does not mean. It defused the whole thing."
        ),
    },
    {
        "client_name": "Faisal M.",
        "location": "Pune",
        "astrologer": "meera-joshi",
        "rating": 4,
        "quote": (
            "Thirty minutes, one question, no padding. Meera helped me get clear on "
            "what I was really deciding between, which was not what I thought when "
            "I booked the call."
        ),
    },
    {
        "client_name": "Lakshmi S.",
        "location": "Hyderabad",
        "astrologer": "sanjay-rao",
        "rating": 5,
        "quote": (
            "Sanjay looked at our plan and told us three of the five changes we were "
            "considering were not worth the money. I have never had a consultant "
            "talk themselves out of work like that."
        ),
    },
]


class Command(BaseCommand):
    help = "Seed the database with demo astrologers, services and testimonials."

    def add_arguments(self, parser):
        parser.add_argument(
            "--with-bookings",
            action="store_true",
            help="Also create a few sample booking requests.",
        )

    def handle(self, *args, **options):
        specs = {}
        for name, slug, description in SPECIALISATIONS:
            spec, _ = Specialisation.objects.update_or_create(
                slug=slug, defaults={"name": name, "description": description}
            )
            specs[slug] = spec
        self.stdout.write(f"Specialisations: {len(specs)}")

        astrologers = {}
        for entry in ASTROLOGERS:
            data = dict(entry)
            slug = data.pop("slug")
            spec_slugs = data.pop("specialisations")
            astrologer, _ = Astrologer.objects.update_or_create(
                slug=slug, defaults=data
            )
            astrologer.specialisations.set([specs[s] for s in spec_slugs])
            astrologers[slug] = astrologer
        self.stdout.write(f"Astrologers: {len(astrologers)}")

        for entry in SERVICES:
            data = dict(entry)
            Service.objects.update_or_create(slug=data.pop("slug"), defaults=data)
        self.stdout.write(f"Services: {len(SERVICES)}")

        for entry in TESTIMONIALS:
            data = dict(entry)
            data["astrologer"] = astrologers[data.pop("astrologer")]
            Testimonial.objects.update_or_create(
                client_name=data["client_name"], defaults=data
            )
        self.stdout.write(f"Testimonials: {len(TESTIMONIALS)}")

        if options["with_bookings"]:
            self._seed_bookings(astrologers)

        self.stdout.write(
            self.style.SUCCESS(
                "Demo data ready. Create an admin login with "
                "`python manage.py createsuperuser`."
            )
        )

    def _seed_bookings(self, astrologers):
        if Booking.objects.exists():
            self.stdout.write("Bookings already present, skipping.")
            return

        chart_reading = Service.objects.get(slug="birth-chart-reading")
        tarot = Service.objects.get(slug="single-question-tarot")
        now = timezone.now()

        Booking.objects.create(
            astrologer=astrologers["aarti-deshmukh"],
            service=chart_reading,
            full_name="Demo Client",
            email="demo.client@example.com",
            phone="+91 98000 00000",
            birth_date=timezone.localdate() - timedelta(days=365 * 30),
            birth_place="Nagpur, India",
            preferred_datetime=now + timedelta(days=3, hours=2),
            mode=Booking.Mode.VIDEO,
            question="Considering a move abroad next year — is the timing sensible?",
        )
        Booking.objects.create(
            astrologer=astrologers["meera-joshi"],
            service=tarot,
            full_name="Second Demo Client",
            email="second.demo@example.com",
            phone="+91 98000 00001",
            preferred_datetime=now + timedelta(days=1, hours=5),
            mode=Booking.Mode.CHAT,
            status=Booking.Status.CONFIRMED,
            question="Should I accept the offer I received this week?",
        )
        self.stdout.write("Bookings: 2")
