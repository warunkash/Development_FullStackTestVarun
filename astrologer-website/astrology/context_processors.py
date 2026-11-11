"""Template context shared by every page."""

from django.utils import timezone

SITE = {
    "name": "Nakshatra",
    "tagline": "Vedic guidance, read carefully and explained plainly.",
    "email": "desk@nakshatra.example",
    # Placeholder in a reserved, non-routable range — replace before any real use.
    "phone": "+91 5550 000 000",
    "hours": "Every day, 8:00 – 21:00 IST",
}

DISCLAIMER = (
    "Readings are offered for reflection and personal insight only. They are not "
    "a substitute for medical, legal, psychological or financial advice."
)


def site_settings(request):
    return {
        "site": SITE,
        "disclaimer": DISCLAIMER,
        "today": timezone.localdate(),
    }
