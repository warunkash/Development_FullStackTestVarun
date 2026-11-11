"""Small presentation helpers used by the templates."""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django import template

register = template.Library()


@register.filter
def rupees(value):
    """Format an amount as Indian rupees.

    Uses the Indian grouping convention (1,00,000 rather than 100,000) and
    keeps paise only when they are non-zero, so whole prices stay clean.
    """
    try:
        amount = Decimal(str(value))
    except (TypeError, ValueError, InvalidOperation):
        return value

    sign = "-" if amount < 0 else ""
    amount = abs(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    whole, paise = divmod(amount, 1)
    digits = str(int(whole))

    # The last three digits group together; everything above them goes in pairs.
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        pairs = [head[max(i - 2, 0):i] for i in range(len(head), 0, -2)][::-1]
        digits = ",".join(pairs + [tail])

    if paise:
        return f"{sign}₹{digits}.{int(paise * 100):02d}"
    return f"{sign}₹{digits}"


@register.filter
def duration(minutes):
    """Render a minute count as '45 min' or '1 hr 15 min'."""
    try:
        total = int(minutes)
    except (TypeError, ValueError):
        return minutes
    hours, mins = divmod(total, 60)
    if not hours:
        return f"{mins} min"
    if not mins:
        return f"{hours} hr"
    return f"{hours} hr {mins} min"


@register.filter
def stars(value):
    """Render a 0-5 rating as filled and hollow stars.

    Rounds half up: Python's round() is half-to-even, which showed 4.5 and 3.5
    as the same four stars right next to the printed number.
    """
    try:
        rating = Decimal(str(value))
    except (TypeError, ValueError, InvalidOperation):
        return ""
    filled = int(rating.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    filled = max(0, min(5, filled))
    return "★" * filled + "☆" * (5 - filled)
