from django.http import HttpResponse
from django.template import loader
from Home.models import Items
from Home.models import Venues
from Home.models import Spaces
from Home.models import Products
from Home.models import Users
from Home.models import Bookers
from Home.models import Bookings
from Home.models import Booking_Items


def index(request):
    items = Items.objects.all()
    venues = Venues.objects.all()
    spaces = Spaces.objects.all()
    products = Products.objects.all()
    users = Users.objects.all()
    bookers = Bookers.objects.all()
    bookings = Bookings.objects.all()
    booking_items = Booking_Items.objects.all()

    template = loader.get_template('Home/index.html')
    context = {
        'items': items,
    }
    return HttpResponse(template.render(context, request))

