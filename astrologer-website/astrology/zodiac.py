"""Zodiac reference data and the deterministic daily-horoscope engine.

Everything here is pure Python with no database access so it can be unit tested
directly and reused by management commands, views and template tags.

The reading generator is *deterministic*: the same sign on the same date always
produces the same reading. That keeps the site stable across requests, workers
and page reloads without needing to persist a row for every sign every day,
while still allowing an editor to override any given day from the admin.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import date

# Elements and modalities used for grouping and filtering in the UI.
FIRE, EARTH, AIR, WATER = "Fire", "Earth", "Air", "Water"
CARDINAL, FIXED, MUTABLE = "Cardinal", "Fixed", "Mutable"


@dataclass(frozen=True)
class Sign:
    """A single zodiac sign and its traditional correspondences."""

    slug: str
    name: str
    symbol: str
    start: tuple[int, int]  # (month, day) the sun enters the sign
    end: tuple[int, int]  # (month, day) the sun leaves the sign, inclusive
    element: str
    modality: str
    ruling_planet: str
    vedic_name: str
    traits: tuple[str, ...] = field(default_factory=tuple)
    summary: str = ""

    @property
    def date_range(self) -> str:
        months = (
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        )
        return (
            f"{months[self.start[0] - 1]} {self.start[1]} – "
            f"{months[self.end[0] - 1]} {self.end[1]}"
        )


# Tropical (Western) sun-sign date bands, which is what a general-audience
# "daily horoscope" column uses. Vedic names are carried alongside because the
# consultation side of the practice is Vedic.
SIGNS: tuple[Sign, ...] = (
    Sign(
        slug="aries", name="Aries", symbol="♈", start=(3, 21), end=(4, 19),
        element=FIRE, modality=CARDINAL, ruling_planet="Mars", vedic_name="Mesha",
        traits=("Courageous", "Direct", "Energetic", "Impatient"),
        summary="The initiator of the zodiac — quick to start, happiest with a challenge in front of them.",
    ),
    Sign(
        slug="taurus", name="Taurus", symbol="♉", start=(4, 20), end=(5, 20),
        element=EARTH, modality=FIXED, ruling_planet="Venus", vedic_name="Vrishabha",
        traits=("Steady", "Patient", "Sensual", "Stubborn"),
        summary="Builds slowly and keeps what it builds. Comfort, security and loyalty matter most.",
    ),
    Sign(
        slug="gemini", name="Gemini", symbol="♊", start=(5, 21), end=(6, 20),
        element=AIR, modality=MUTABLE, ruling_planet="Mercury", vedic_name="Mithuna",
        traits=("Curious", "Articulate", "Adaptable", "Restless"),
        summary="Thinks out loud and learns by talking. Thrives on variety and fresh information.",
    ),
    Sign(
        slug="cancer", name="Cancer", symbol="♋", start=(6, 21), end=(7, 22),
        element=WATER, modality=CARDINAL, ruling_planet="Moon", vedic_name="Karka",
        traits=("Protective", "Intuitive", "Loyal", "Guarded"),
        summary="Leads with feeling and memory. Home and chosen family are the anchor points.",
    ),
    Sign(
        slug="leo", name="Leo", symbol="♌", start=(7, 23), end=(8, 22),
        element=FIRE, modality=FIXED, ruling_planet="Sun", vedic_name="Simha",
        traits=("Warm", "Generous", "Confident", "Proud"),
        summary="Gives generously and wants the effort seen. Natural warmth that draws a crowd.",
    ),
    Sign(
        slug="virgo", name="Virgo", symbol="♍", start=(8, 23), end=(9, 22),
        element=EARTH, modality=MUTABLE, ruling_planet="Mercury", vedic_name="Kanya",
        traits=("Precise", "Practical", "Helpful", "Self-critical"),
        summary="Improves whatever it touches. Service and craft are how care gets expressed.",
    ),
    Sign(
        slug="libra", name="Libra", symbol="♎", start=(9, 23), end=(10, 22),
        element=AIR, modality=CARDINAL, ruling_planet="Venus", vedic_name="Tula",
        traits=("Fair", "Charming", "Diplomatic", "Indecisive"),
        summary="Weighs every side before moving. Partnership and balance are the organising theme.",
    ),
    Sign(
        slug="scorpio", name="Scorpio", symbol="♏", start=(10, 23), end=(11, 21),
        element=WATER, modality=FIXED, ruling_planet="Mars & Pluto", vedic_name="Vrishchika",
        traits=("Intense", "Perceptive", "Private", "Unyielding"),
        summary="Goes all the way in or not at all. Reads the room long before anyone speaks.",
    ),
    Sign(
        slug="sagittarius", name="Sagittarius", symbol="♐", start=(11, 22), end=(12, 21),
        element=FIRE, modality=MUTABLE, ruling_planet="Jupiter", vedic_name="Dhanu",
        traits=("Optimistic", "Frank", "Adventurous", "Blunt"),
        summary="Needs room to roam, literally or intellectually. Truth-telling over tact.",
    ),
    Sign(
        slug="capricorn", name="Capricorn", symbol="♑", start=(12, 22), end=(1, 19),
        element=EARTH, modality=CARDINAL, ruling_planet="Saturn", vedic_name="Makara",
        traits=("Disciplined", "Ambitious", "Reliable", "Reserved"),
        summary="Plays the long game and keeps score quietly. Structure turns ambition into results.",
    ),
    Sign(
        slug="aquarius", name="Aquarius", symbol="♒", start=(1, 20), end=(2, 18),
        element=AIR, modality=FIXED, ruling_planet="Saturn & Uranus", vedic_name="Kumbha",
        traits=("Original", "Principled", "Independent", "Detached"),
        summary="Thinks in systems and futures. Loyal to ideas as much as to people.",
    ),
    Sign(
        slug="pisces", name="Pisces", symbol="♓", start=(2, 19), end=(3, 20),
        element=WATER, modality=MUTABLE, ruling_planet="Jupiter & Neptune", vedic_name="Meena",
        traits=("Compassionate", "Imaginative", "Gentle", "Escapist"),
        summary="Absorbs the mood of a room. Creativity and empathy are the same muscle here.",
    ),
)

SIGNS_BY_SLUG: dict[str, Sign] = {sign.slug: sign for sign in SIGNS}


def sign_for_date(value: date) -> Sign:
    """Return the tropical sun sign covering ``value``.

    Capricorn wraps across the new year, so it is handled as the fallback: any
    date that does not fall inside a within-year band belongs to Capricorn.
    """
    month, day = value.month, value.day
    for sign in SIGNS:
        if sign.start[0] <= sign.end[0]:  # band contained within one year
            after_start = (month, day) >= sign.start
            before_end = (month, day) <= sign.end
            if after_start and before_end:
                return sign
    return SIGNS_BY_SLUG["capricorn"]


def get_sign(slug: str) -> Sign | None:
    """Look up a sign by slug, case-insensitively."""
    return SIGNS_BY_SLUG.get((slug or "").strip().lower())


# --- Deterministic reading generator -------------------------------------

GENERAL_OPENERS = (
    "The Moon moves through a cooperative angle to your ruler today",
    "A slower morning gives way to a much clearer afternoon",
    "Something you shelved weeks ago comes back around",
    "The day rewards preparation over improvisation",
    "A conversation you have been avoiding turns out to be the easy part",
    "Momentum builds quietly rather than dramatically",
    "You are being asked to choose depth over speed",
    "An ordinary day carries one genuinely useful signal",
    "Your ruling planet is doing steady rather than spectacular work",
    "The week's pattern finally becomes visible from here",
    "An early irritation turns out to be pointing at something real",
    "Two competing priorities stop competing once you name them",
    "The obvious answer is probably the right one this time",
    "A small correction now saves a large one later",
    "Today favours the practical over the interesting",
    "You have more room to manoeuvre than you are using",
)

GENERAL_CLOSERS = (
    "so keep the first half of the day light and commit later.",
    "so say the plain version of what you mean.",
    "so let one small thing be finished rather than three be started.",
    "so trust the read you had before anyone else weighed in.",
    "so protect your energy from an unnecessary debate.",
    "so write the decision down before you act on it.",
    "so give it until evening before you call it settled.",
    "so let the detail you noticed early guide the rest.",
    "so ask the question rather than assuming the answer.",
    "so choose the option you could explain to a stranger.",
    "so do the difficult part while your attention is fresh.",
    "so leave a margin around whatever you commit to.",
    "so stop refining something that is already good enough.",
    "so take the slower route if it is the surer one.",
    "so let someone else carry a piece of it today.",
    "so keep your own counsel until the picture settles.",
)

LOVE_LINES = (
    "Warmth arrives through consistency rather than grand gestures.",
    "A candid sentence clears more air than a week of patience would.",
    "Give a partner or close friend the benefit of the doubt once more.",
    "Someone is reading your silence as distance — close that gap.",
    "Shared plans feel easier to make today; make one concrete.",
    "Attraction favours substance over polish right now.",
    "An old misunderstanding softens if nobody reopens the scoreboard.",
    "Time alone recharges the relationship more than forced togetherness.",
    "Say the specific thing rather than the diplomatic one.",
    "A small kindness lands harder than it looks like it should.",
    "Let a disagreement rest overnight before you resolve it.",
    "Someone is waiting for you to go first. Go first.",
    "Company you did not plan for improves the day.",
    "Loyalty shows in the ordinary hours, not the memorable ones.",
    "Be generous with attention and careful with advice.",
    "An honest no protects the relationship more than a reluctant yes.",
)

CAREER_LINES = (
    "Finish the unglamorous task first; it unlocks the rest.",
    "Your judgement is sharper than your calendar suggests — defend your focus.",
    "A senior colleague notices reliability more than brilliance today.",
    "Put the proposal in writing before the meeting, not after.",
    "Decline the request that would spread you across three priorities.",
    "A quiet review of the numbers turns up something worth raising.",
    "Collaboration goes further than a solo sprint this week.",
    "Document what you did — it becomes the case you make later.",
    "Ask for the resource before the deadline, not after it.",
    "The work you find boring is the work that compounds.",
    "Say what you actually need in the room where it can be given.",
    "Check the assumption everyone has stopped questioning.",
    "Progress today looks like removing something, not adding it.",
    "Credit given away now comes back with interest.",
    "A short, clear message beats a long, careful one.",
    "Protect two uninterrupted hours and the day works.",
)

HEALTH_LINES = (
    "Hydration and a proper break do more than an extra hour of effort.",
    "Your sleep, not your schedule, is the variable to fix this week.",
    "Step outside at least once during daylight.",
    "Gentle movement suits today better than an intense session.",
    "Eat at regular hours; the day gets bumpy on an empty stomach.",
    "Screen fatigue is the likely cause of that low mood — reduce it.",
    "A short walk after the hardest task resets your focus.",
    "Rest is productive today, not a concession.",
    "Notice where you are holding tension and let it go.",
    "Your energy dips on schedule — plan around it rather than fighting it.",
    "One good meal is worth three good intentions.",
    "Put the phone down an hour before sleep.",
    "Stretch before the day rather than after it.",
    "Caffeine is borrowing from this evening; borrow less.",
    "A slow start is not the same as a lost day.",
    "Ask for help with the physical task you keep postponing.",
)

MOODS = (
    "Reflective", "Steady", "Optimistic", "Focused",
    "Restless", "Generous", "Grounded", "Curious",
    "Patient",
    "Determined",
    "Light",
    "Contemplative",
    "Sociable",
    "Practical",
    "Hopeful",
    "Unhurried",
)

COLOURS = (
    "Marigold", "Deep indigo", "Sandalwood", "Emerald",
    "Pearl white", "Terracotta", "Saffron", "Midnight blue",
    "Copper",
    "Sea green",
    "Ivory",
    "Amethyst",
    "Ochre",
    "Slate blue",
    "Rose",
    "Forest green",
)


@dataclass(frozen=True)
class Reading:
    """A generated daily reading for one sign."""

    sign: Sign
    day: date
    general: str
    love: str
    career: str
    health: str
    mood: str
    lucky_number: int
    lucky_colour: str
    is_editorial: bool = False


def _seed(sign: Sign, day: date) -> bytes:
    """Stable digest derived from the sign and date.

    ``hash()`` is salted per process in Python 3, so a SHA-256 digest is used
    instead to keep readings identical across restarts and worker processes.
    """
    return hashlib.sha256(f"{sign.slug}:{day.isoformat()}".encode()).digest()


def _pick(options: tuple[str, ...], seed: bytes, slot: int) -> str:
    """Choose one option using its own four bytes of the digest.

    Each slot reads a disjoint window of the hash so the sections vary
    independently of one another.
    """
    start = (slot * 4) % (len(seed) - 4)
    window = int.from_bytes(seed[start:start + 4], "big")
    return options[window % len(options)]


def generate_reading(sign: Sign, day: date) -> Reading:
    """Build the deterministic reading for ``sign`` on ``day``."""
    seed = _seed(sign, day)
    opener = _pick(GENERAL_OPENERS, seed, 1)
    closer = _pick(GENERAL_CLOSERS, seed, 2)
    return Reading(
        sign=sign,
        day=day,
        general=f"{opener}, {closer}",
        love=_pick(LOVE_LINES, seed, 3),
        career=_pick(CAREER_LINES, seed, 4),
        health=_pick(HEALTH_LINES, seed, 5),
        mood=_pick(MOODS, seed, 6),
        lucky_number=(seed[0] % 9) + 1,
        lucky_colour=_pick(COLOURS, seed, 7),
    )


def compatibility_score(first: Sign, second: Sign) -> int:
    """Traditional element/modality compatibility as a 0-100 score.

    Same element is most harmonious, complementary elements (fire/air and
    earth/water) next, and the remaining pairings are the friction-heavy ones.
    Sharing a modality adds tension between otherwise compatible signs, which is
    why it subtracts rather than adds.
    """
    complementary = {frozenset({FIRE, AIR}), frozenset({EARTH, WATER})}
    if first.element == second.element:
        base = 88
    elif frozenset({first.element, second.element}) in complementary:
        base = 76
    else:
        base = 58

    if first.slug == second.slug:
        base += 4
    elif first.modality == second.modality:
        base -= 9

    return max(0, min(100, base))
