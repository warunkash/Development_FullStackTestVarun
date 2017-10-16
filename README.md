# Full-Stack Developer Test

Hi Full-stacker!

The exercise exists of a few assignments. They are related to the SkyGeo way of working.

To complete these assignments you need to clone this repo. When you're done you can push your changes to your own repo (commit often!).


## Assignment 1: Build a REST API with Django

In this exercise we have an example database structure and the dummy data to fill the database. You are free to choose any database you are most comfortable working with.

The PHP models and some extra PHP application code are just for your reference.

The task is to setup a Django application with:

* Model objects which represents the data structure in data/database.sql
* Dump all the data of assignment/data.sql to the database your django generated
* Authentication
* A Django REST API so that it can serve assignment 2
* Django admin site


[New to django? No problem! Follow the tutorial to get started] (https://docs.djangoproject.com/en/1.11/intro/tutorial01/)
Your resulting Django application should be placed in `assignment1/django/`. Make sure you pick a solution which is easily maintainable. If special software is needed to run the code make sure this is documented.


## Assignment 2: Add a Front-End to your Django application

Now you have written a simple API in Django you are going to add an index page to the it. The index page should be a SPA (Single Page Application). It's recommended to use frameworks like React or Angular for this purpose.

The application should be a simple interface to view the data provided by the API. It should have at least the following features:

* Overview of bookings
  * Paginated
  * The bookings should be searchable. Make them searchable on at least the following data:
    * Booking ID
    * Space name
    * Product name
    * Venue name
    * Booker name / email
* View one specific booking
  * Make sure you show all relevant data of the booking:
    * Booker
    * Space
    * Products
    * Venue
* The whole application should look nice and should be user friendly
* The application should have possibilities to navigate between the different interfaces

For the search function to work you probably need to extend the API with the search functionality.

Note the following things:
* It's allowed to use a CSS framework, however, you are encouraged to write your own (we want to see how you write CSS)
* CSS pre-processors like SASS and LESS are recommended
* Make sure your code is well structured and reusable
* Bonus: making extra additions to the API
  * API for spaces / products
  * CRUD APIs
  * Etc.


## Notes:

Commit Often, Perfect Later, Publish Once
