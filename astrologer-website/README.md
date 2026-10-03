# Nakshatra — an online astrology consultancy

A complete Django site for an astrology practice: public pages, a daily
horoscope engine, a consultation booking flow with client accounts, and a
back office for the desk to work the enquiries.

Built with Django 5 and the standard library only — no third-party runtime
dependencies beyond Django itself.

## Running it

```bash
cd astrologer-website
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

python manage.py migrate
python manage.py seed_demo --with-bookings   # optional demo content
python manage.py createsuperuser             # for the admin
python manage.py runserver
```

Then open <http://127.0.0.1:8000/>. The admin is at `/admin/`.

## Tests

```bash
python manage.py test
```

69 tests covering the zodiac logic, models, form validation and every public
view including the full booking flow.

## What's in it

| Area | Route | Notes |
| --- | --- | --- |
| Home | `/` | Practice overview, today's sun sign, featured services |
| Astrologers | `/astrologers/` | Searchable and filterable by speciality or language |
| Profile | `/astrologers/<slug>/` | Bio, rates, feedback, availability |
| Services | `/services/` | Six consultation packages with detail pages |
| Daily horoscope | `/horoscope/` | All twelve signs |
| Sign detail | `/horoscope/<sign>/` | Today plus three days ahead, compatibility |
| Sign lookup | `/horoscope/find-my-sign/` | Sun sign from a date of birth |
| Booking | `/book/` | Guest or signed-in, with birth details |
| My bookings | `/my-bookings/` | Status of a client's own requests |
| Accounts | `/accounts/…` | Sign in, sign up, sign out |
| Admin | `/admin/` | Full back office |

## How the horoscope engine works

`astrology/zodiac.py` holds the twelve signs and a **deterministic** reading
generator. The same sign on the same date always produces the same reading,
because each reading is derived from a SHA-256 digest of `sign:date` rather
than from a random number — so readings stay stable across page reloads,
restarts and worker processes without storing a row for every sign every day.

The copy pools are sized so that visible repetition stays low: 16 openers and
16 closers give 256 general readings, which puts a repeat on the three-day
panel at roughly 1%.

An editor can override any sign on any day by adding a `DailyHoroscope` row in
the admin. `reading_for()` prefers a stored row and falls back to the generated
one, and the sign page marks a hand-written reading as being from the desk.

The module is pure Python with no database access, which is why most of the
test suite can exercise it directly.

## Booking flow

1. A visitor picks an astrologer and a service (pre-filled when they arrive
   from a profile or service page).
2. `BookingForm` validates the request: appointments must be in the future,
   birth dates must not be, and chart-based services require date and place of
   birth. Astrologers who have paused bookings are rejected at validation.
3. The booking is saved with a phone-friendly reference such as `NK-EHMS38`
   (the alphabet excludes `0/O` and `1/I`), the desk is e-mailed, and the
   client lands on a confirmation page.
4. Signed-in clients see their bookings at `/my-bookings/`, which also matches
   guest bookings made with the same e-mail address.

Nothing is charged on the site — payment is arranged by the desk once a slot
is confirmed, which is why `Booking` carries a status rather than a payment.

## Configuration

Settings read from the environment, with development-friendly defaults. See
`.env.example`. At minimum set `NAKSHATRA_SECRET_KEY` and
`NAKSHATRA_ALLOWED_HOSTS` and turn `NAKSHATRA_DEBUG` off outside development;
the secure-cookie, HSTS and SSL-redirect settings switch on automatically when
`DEBUG` is false.

The database is SQLite by default. Point `DATABASES` at PostgreSQL for a real
deployment — no model in this project depends on SQLite.

## A note on the content

This is a demonstration project, not a live business. The astrologers,
testimonials and prices are fictional.

The site is deliberately written to avoid the patterns that make astrology
sites predatory: no fear-selling, no paid remedies, no claims of medical,
legal or financial authority. A disclaimer to that effect appears on every
page, and the About page is explicit that astrology is a symbolic tradition
rather than a science. If you adapt this for real use, please keep that part.
