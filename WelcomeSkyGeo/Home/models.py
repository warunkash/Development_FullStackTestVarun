from django.db import models

# Create your models here.


class Venues(models.Model):
    name = models.CharField(max_length=255)

class Items(models.Model):
    venue = models.IntegerField()
    name = models.CharField(max_length=255)
    venue = models.ForeignKey(Venues, on_delete=models.CASCADE)

class Spaces(models.Model):
    item = models.IntegerField()
    hour_price = models.DecimalField(max_digits=6, decimal_places=2)
    item = models.ForeignKey(Items, on_delete=models.CASCADE)

class Products(models.Model):
    item = models.IntegerField()
    price = models.DecimalField(max_digits=6, decimal_places=2)
    item = models.ForeignKey(Items, on_delete=models.CASCADE)

class Users(models.Model):
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    registered = models.IntegerField(default=0)
    email = models.CharField(max_length=255)

class Bookers(models.Model):
    user = models.IntegerField()
    created = models.IntegerField(default=0)
    user = models.ForeignKey(Users, on_delete=models.CASCADE)

class Bookings(models.Model):
    booker = models.IntegerField()
    created = models.IntegerField(default=0)
    booker = models.ForeignKey(Bookers, on_delete=models.CASCADE)

class Booking_Items(models.Model):
    booking = models.IntegerField()
    item = models.IntegerField()
    quantity = models.IntegerField()
    locked_piece_price = models.DecimalField(max_digits=6, decimal_places=2)
    locked_total_price = models.DecimalField(max_digits=6, decimal_places=2)
    start_timestamp = models.IntegerField()
    end_timestamp = models.IntegerField()
    booking = models.ForeignKey(Bookings, on_delete=models.CASCADE)
    item = models.ForeignKey(Items, on_delete=models.CASCADE)