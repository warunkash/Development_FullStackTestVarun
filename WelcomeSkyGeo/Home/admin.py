from django.contrib import admin
from Home.models import Items
from Home.models import Venues
from Home.models import Spaces
from Home.models import Products
from Home.models import Users
from Home.models import Bookers
from Home.models import Bookings
from Home.models import Booking_Items

admin.site.register(Items)
admin.site.register(Venues)
admin.site.register(Spaces)
admin.site.register(Products)
admin.site.register(Users)
admin.site.register(Bookers)
admin.site.register(Bookings)
admin.site.register(Booking_Items)