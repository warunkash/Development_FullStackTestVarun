"""Back-office configuration for the consultation desk."""

from django.contrib import admin, messages
from django.utils.html import format_html

from .models import (
    Astrologer,
    Booking,
    DailyHoroscope,
    Service,
    Specialisation,
    Testimonial,
)

admin.site.site_header = "Nakshatra administration"
admin.site.site_title = "Nakshatra admin"
admin.site.index_title = "Consultation desk"


@admin.register(Specialisation)
class SpecialisationAdmin(admin.ModelAdmin):
    list_display = ("name", "description")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name",)


@admin.register(Astrologer)
class AstrologerAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "years_experience",
        "rating",
        "rate_per_minute",
        "is_accepting_bookings",
        "is_published",
        "display_order",
    )
    list_filter = ("is_published", "is_accepting_bookings", "specialisations")
    list_editable = ("is_accepting_bookings", "is_published", "display_order")
    search_fields = ("name", "headline", "bio", "languages")
    prepopulated_fields = {"slug": ("name",)}
    filter_horizontal = ("specialisations",)
    fieldsets = (
        (None, {"fields": ("name", "slug", "headline", "bio", "photo_url")}),
        ("Practice", {"fields": ("specialisations", "languages", "years_experience")}),
        ("Commercials", {"fields": ("rate_per_minute", "rating", "consultations_done")}),
        (
            "Visibility",
            {"fields": ("is_published", "is_accepting_bookings", "display_order")},
        ),
    )


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "price",
        "duration_minutes",
        "requires_birth_details",
        "is_published",
        "display_order",
    )
    list_filter = ("is_published", "requires_birth_details")
    list_editable = ("is_published", "display_order")
    search_fields = ("name", "tagline", "description")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(DailyHoroscope)
class DailyHoroscopeAdmin(admin.ModelAdmin):
    list_display = ("sign", "day", "mood", "lucky_number", "author")
    list_filter = ("sign", "day")
    date_hierarchy = "day"
    search_fields = ("general", "love", "career", "health")
    autocomplete_fields = ()

    def save_model(self, request, obj, form, change):
        if obj.author_id is None:
            obj.author = request.user
        super().save_model(request, obj, form, change)


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "full_name",
        "astrologer",
        "service",
        "preferred_datetime",
        "mode",
        "status_badge",
    )
    list_filter = ("status", "mode", "astrologer", "service", "created_at")
    search_fields = ("reference", "full_name", "email", "phone", "question")
    readonly_fields = ("reference", "created_at", "updated_at", "sun_sign_display")
    date_hierarchy = "preferred_datetime"
    list_select_related = ("astrologer", "service")
    actions = ("mark_confirmed", "mark_completed", "mark_cancelled")
    fieldsets = (
        (None, {"fields": ("reference", "status", "admin_notes")}),
        ("Client", {"fields": ("user", "full_name", "email", "phone")}),
        (
            "Birth details",
            {"fields": ("birth_date", "birth_time", "birth_place", "sun_sign_display")},
        ),
        (
            "Session",
            {"fields": ("astrologer", "service", "preferred_datetime", "mode", "question")},
        ),
        ("Timestamps", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    @admin.display(description="Status")
    def status_badge(self, obj):
        colours = {
            Booking.Status.PENDING: "#b45309",
            Booking.Status.CONFIRMED: "#15803d",
            Booking.Status.COMPLETED: "#1d4ed8",
            Booking.Status.CANCELLED: "#b91c1c",
        }
        return format_html(
            '<span style="color:{};font-weight:600">{}</span>',
            colours.get(obj.status, "#334155"),
            obj.get_status_display(),
        )

    @admin.display(description="Sun sign")
    def sun_sign_display(self, obj):
        sign = obj.sun_sign
        return f"{sign.symbol} {sign.name}" if sign else "—"

    def _bulk_set(self, request, queryset, status, label):
        updated = queryset.update(status=status)
        self.message_user(
            request, f"{updated} booking(s) marked {label}.", messages.SUCCESS
        )

    @admin.action(description="Mark selected bookings as confirmed")
    def mark_confirmed(self, request, queryset):
        self._bulk_set(request, queryset, Booking.Status.CONFIRMED, "confirmed")

    @admin.action(description="Mark selected bookings as completed")
    def mark_completed(self, request, queryset):
        self._bulk_set(request, queryset, Booking.Status.COMPLETED, "completed")

    @admin.action(description="Mark selected bookings as cancelled")
    def mark_cancelled(self, request, queryset):
        self._bulk_set(request, queryset, Booking.Status.CANCELLED, "cancelled")


@admin.register(Testimonial)
class TestimonialAdmin(admin.ModelAdmin):
    list_display = ("client_name", "location", "astrologer", "rating", "is_published")
    list_filter = ("is_published", "rating", "astrologer")
    list_editable = ("is_published",)
    search_fields = ("client_name", "quote")
