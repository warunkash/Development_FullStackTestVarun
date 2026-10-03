from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("astrologers/", views.astrologer_list, name="astrologer_list"),
    path("astrologers/<slug:slug>/", views.astrologer_detail, name="astrologer_detail"),
    path("services/", views.service_list, name="service_list"),
    path("services/<slug:slug>/", views.service_detail, name="service_detail"),
    path("horoscope/", views.horoscope_index, name="horoscope_index"),
    path("horoscope/find-my-sign/", views.find_my_sign, name="find_my_sign"),
    path("horoscope/<slug:slug>/", views.horoscope_detail, name="horoscope_detail"),
    path("book/", views.book, name="book"),
    path("book/<str:reference>/", views.booking_confirmation, name="booking_confirmation"),
    path("my-bookings/", views.my_bookings, name="my_bookings"),
    path("accounts/signup/", views.signup, name="signup"),
    path("about/", views.about, name="about"),
]
