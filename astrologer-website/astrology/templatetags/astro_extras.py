"""Small presentation helpers used by the templates."""

from django import template

register = template.Library()


@register.filter
def rupees(value):
    """Format a decimal as Indian rupees with thousands separators."""
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return value
    return f"₹{amount:,.0f}"


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
    """Render a 0-5 rating as filled and hollow stars."""
    try:
        filled = int(round(float(value)))
    except (TypeError, ValueError):
        return ""
    filled = max(0, min(5, filled))
    return "★" * filled + "☆" * (5 - filled)
