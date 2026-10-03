"""Forms for booking a consultation and for client sign-up."""

from __future__ import annotations

from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.utils import timezone

from .models import Astrologer, Booking, Service


class BookingForm(forms.ModelForm):
    """Collects everything needed to schedule a consultation.

    Birth details are optional at the field level because not every service is
    chart-based; ``clean`` enforces them for the services that are.
    """

    class Meta:
        model = Booking
        fields = (
            "astrologer",
            "service",
            "full_name",
            "email",
            "phone",
            "birth_date",
            "birth_time",
            "birth_place",
            "preferred_datetime",
            "mode",
            "question",
        )
        widgets = {
            "birth_date": forms.DateInput(attrs={"type": "date"}),
            "birth_time": forms.TimeInput(attrs={"type": "time"}),
            "preferred_datetime": forms.DateTimeInput(attrs={"type": "datetime-local"}),
            "question": forms.Textarea(attrs={"rows": 4}),
            "birth_place": forms.TextInput(
                attrs={"placeholder": "City and country of birth"}
            ),
        }
        labels = {
            "full_name": "Your name",
            "preferred_datetime": "Preferred date and time",
            "question": "What would you like the session to focus on?",
            "mode": "How would you like to meet?",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["astrologer"].queryset = Astrologer.objects.filter(
            is_published=True, is_accepting_bookings=True
        )
        self.fields["service"].queryset = Service.objects.filter(is_published=True)
        self.fields["phone"].required = True
        for field in self.fields.values():
            widget = field.widget
            if isinstance(widget, (forms.TextInput, forms.EmailInput, forms.Textarea,
                                   forms.DateInput, forms.TimeInput,
                                   forms.DateTimeInput, forms.Select)):
                css = widget.attrs.get("class", "")
                widget.attrs["class"] = (css + " field-input").strip()

    def clean_preferred_datetime(self):
        value = self.cleaned_data["preferred_datetime"]
        if value < timezone.now():
            raise forms.ValidationError(
                "Please choose a date and time in the future."
            )
        return value

    def clean_birth_date(self):
        value = self.cleaned_data.get("birth_date")
        if value and value > timezone.localdate():
            raise forms.ValidationError("A birth date cannot be in the future.")
        return value

    def clean(self):
        cleaned = super().clean()
        service = cleaned.get("service")
        if service is not None and service.requires_birth_details:
            for name, label in (
                ("birth_date", "date of birth"),
                ("birth_place", "place of birth"),
            ):
                if not cleaned.get(name):
                    self.add_error(
                        name,
                        f"{service.name} is read from your chart, so your "
                        f"{label} is required.",
                    )

        astrologer = cleaned.get("astrologer")
        if astrologer is not None and not astrologer.is_accepting_bookings:
            self.add_error(
                "astrologer",
                f"{astrologer.name} is not taking new bookings at the moment.",
            )
        return cleaned


class SignUpForm(UserCreationForm):
    """Registration with an e-mail so bookings can be matched to an account."""

    email = forms.EmailField(required=True)
    first_name = forms.CharField(max_length=30, required=False, label="First name")

    class Meta:
        model = User
        fields = ("username", "first_name", "email")

    def clean_email(self):
        email = self.cleaned_data["email"]
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("An account with this e-mail already exists.")
        return email

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data["email"]
        user.first_name = self.cleaned_data.get("first_name", "")
        if commit:
            user.save()
        return user
