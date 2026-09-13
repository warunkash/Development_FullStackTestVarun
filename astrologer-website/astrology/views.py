"""Public site views."""

from __future__ import annotations

from datetime import date, timedelta

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.core.mail import send_mail
from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from . import zodiac
from .forms import BookingForm, SignUpForm
from .models import (
    Astrologer,
    Booking,
    Service,
    Specialisation,
    Testimonial,
    reading_for,
)


def home(request):
    today = timezone.localdate()
    return render(
        request,
        "astrology/home.html",
        {
            "astrologers": Astrologer.objects.filter(is_published=True)
            .prefetch_related("specialisations")[:3],
            "services": Service.objects.filter(is_published=True)[:4],
            "testimonials": Testimonial.objects.filter(is_published=True)[:3],
            "signs": zodiac.SIGNS,
            "sign_of_today": zodiac.sign_for_date(today),
            "featured_reading": reading_for(zodiac.sign_for_date(today), today),
        },
    )


def astrologer_list(request):
    astrologers = Astrologer.objects.filter(is_published=True).prefetch_related(
        "specialisations"
    )

    query = request.GET.get("q", "").strip()
    if query:
        astrologers = astrologers.filter(
            Q(name__icontains=query)
            | Q(headline__icontains=query)
            | Q(languages__icontains=query)
            | Q(specialisations__name__icontains=query)
        ).distinct()

    speciality = request.GET.get("speciality", "").strip()
    if speciality:
        astrologers = astrologers.filter(specialisations__slug=speciality).distinct()

    return render(
        request,
        "astrology/astrologer_list.html",
        {
            "astrologers": astrologers,
            "query": query,
            "speciality": speciality,
            "specialisations": Specialisation.objects.all(),
        },
    )


def astrologer_detail(request, slug):
    astrologer = get_object_or_404(
        Astrologer.objects.prefetch_related("specialisations", "testimonials"),
        slug=slug,
        is_published=True,
    )
    return render(
        request,
        "astrology/astrologer_detail.html",
        {
            "astrologer": astrologer,
            "services": Service.objects.filter(is_published=True),
            "testimonials": astrologer.testimonials.filter(is_published=True)[:4],
        },
    )


def service_list(request):
    return render(
        request,
        "astrology/service_list.html",
        {"services": Service.objects.filter(is_published=True)},
    )


def service_detail(request, slug):
    service = get_object_or_404(Service, slug=slug, is_published=True)
    return render(
        request,
        "astrology/service_detail.html",
        {
            "service": service,
            "astrologers": Astrologer.objects.filter(
                is_published=True, is_accepting_bookings=True
            )[:3],
        },
    )


def horoscope_index(request):
    today = timezone.localdate()
    return render(
        request,
        "astrology/horoscope_index.html",
        {
            "readings": [reading_for(sign, today) for sign in zodiac.SIGNS],
            "day": today,
        },
    )


def horoscope_detail(request, slug):
    sign = zodiac.get_sign(slug)
    if sign is None:
        raise Http404("Unknown zodiac sign.")

    today = timezone.localdate()
    week = [reading_for(sign, today + timedelta(days=offset)) for offset in range(1, 4)]
    return render(
        request,
        "astrology/horoscope_detail.html",
        {
            "sign": sign,
            "reading": reading_for(sign, today),
            "upcoming": week,
            "day": today,
            "compatible": sorted(
                (
                    (other, zodiac.compatibility_score(sign, other))
                    for other in zodiac.SIGNS
                    if other.slug != sign.slug
                ),
                key=lambda pair: pair[1],
                reverse=True,
            )[:4],
        },
    )


def find_my_sign(request):
    """Look up a sun sign from a date of birth."""
    result = None
    error = None
    raw = request.GET.get("dob", "").strip()
    if raw:
        try:
            year, month, day = (int(part) for part in raw.split("-"))
            born = date(year, month, day)
        except (ValueError, TypeError):
            error = "Please enter a valid date."
        else:
            if born > timezone.localdate():
                error = "That date is in the future."
            else:
                result = zodiac.sign_for_date(born)

    return render(
        request,
        "astrology/find_my_sign.html",
        {"result": result, "error": error, "dob": raw},
    )


def book(request):
    initial = {}
    for param, field in (("astrologer", "astrologer"), ("service", "service")):
        slug = request.GET.get(param)
        if not slug:
            continue
        model = Astrologer if param == "astrologer" else Service
        obj = model.objects.filter(slug=slug, is_published=True).first()
        if obj is not None:
            initial[field] = obj.pk

    if request.user.is_authenticated:
        initial.setdefault("full_name", request.user.get_full_name() or request.user.username)
        initial.setdefault("email", request.user.email)

    if request.method == "POST":
        form = BookingForm(request.POST)
        if form.is_valid():
            booking = form.save(commit=False)
            if request.user.is_authenticated:
                booking.user = request.user
            booking.save()
            _notify_desk(booking)
            messages.success(
                request,
                f"Thank you — your request {booking.reference} has been received.",
            )
            return redirect("booking_confirmation", reference=booking.reference)
        messages.error(request, "Please correct the highlighted fields.")
    else:
        form = BookingForm(initial=initial)

    return render(request, "astrology/book.html", {"form": form})


def _notify_desk(booking: Booking) -> None:
    """E-mail the consultation desk. Never let a mail failure lose a booking."""
    subject = f"New consultation request {booking.reference}"
    body = (
        f"Reference: {booking.reference}\n"
        f"Name: {booking.full_name}\n"
        f"E-mail: {booking.email}\n"
        f"Phone: {booking.phone}\n"
        f"Astrologer: {booking.astrologer.name}\n"
        f"Service: {booking.service.name}\n"
        f"Preferred: {booking.preferred_datetime:%d %b %Y, %H:%M}\n"
        f"Mode: {booking.get_mode_display()}\n\n"
        f"Question:\n{booking.question or '(none given)'}\n"
    )
    try:
        send_mail(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            [settings.CONSULTATION_DESK_EMAIL],
            fail_silently=True,
        )
    except Exception:  # pragma: no cover - defensive, mail is not critical path
        pass


def booking_confirmation(request, reference):
    booking = get_object_or_404(Booking, reference=reference)
    return render(request, "astrology/booking_confirmation.html", {"booking": booking})


@login_required
def my_bookings(request):
    bookings = Booking.objects.filter(
        Q(user=request.user) | Q(email__iexact=request.user.email)
    ).select_related("astrologer", "service").distinct()
    return render(request, "astrology/my_bookings.html", {"bookings": bookings})


def signup(request):
    if request.user.is_authenticated:
        return redirect("my_bookings")

    if request.method == "POST":
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, "Welcome to Nakshatra.")
            return redirect("my_bookings")
    else:
        form = SignUpForm()
    return render(request, "registration/signup.html", {"form": form})


def about(request):
    return render(
        request,
        "astrology/about.html",
        {"astrologers": Astrologer.objects.filter(is_published=True)},
    )
