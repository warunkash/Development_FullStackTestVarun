"""Brand-safety gate for autonomously chosen topics.

Trending feeds surface whatever is spiking, which regularly means a shooting, a
death, or a disaster. A pipeline that publishes without a human in the loop has
no chance to catch that after the fact, so candidate topics are filtered before
anything is written about them.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Categories a faceless, unattended channel should not narrate off a trend feed.
# These patterns are deliberately blunt: they over-block ("the die is cast" trips
# the obituary rule) because discovery always returns a ranked list, so skipping a
# usable topic costs one list position, while publishing over a tragedy does not
# get to be undone.
_BLOCKED_PATTERNS: dict[str, tuple[str, ...]] = {
    "death": (
        r"\bdie(?:s|d)?\b", r"\bdeath[s]?\b", r"\bdead\b", r"\bobituar", r"\bkilled\b",
        r"\bfatal(?:ity|ities)?\b", r"\bpasses? away\b", r"\bmourn",
    ),
    "violence": (
        r"\bshoot(?:ing|er)\b", r"\bstabb", r"\bmurder", r"\bassault\b",
        r"\bterror", r"\bmassacre\b", r"\bhostage\b", r"\bkidnap",
        r"\bbomb(?:ing|er)\b", r"\bgunman\b",
    ),
    "conflict": (
        r"\bwar\b", r"\bairstrike", r"\binvasion\b", r"\bmilitant", r"\bcasualt",
        r"\bgenocide\b", r"\bceasefire\b",
    ),
    "disaster": (
        r"\bearthquake\b", r"\bwildfire", r"\bhurricane\b", r"\bplane crash\b",
        r"\bderail", r"\bexplosion\b", r"\bflood(?:ing|s)?\b", r"\blandslide\b",
    ),
    "self_harm": (r"\bsuicid", r"\bself[- ]harm\b", r"\boverdose\b"),
    "abuse": (
        r"\brape\b", r"\bsexual assault\b", r"\bmolest", r"\btraffick",
        r"\bchild abuse\b",
    ),
    "medical_claims": (r"\bcure for\b", r"\bmiracle cure\b", r"\bweight loss pill"),
    "explicit": (r"\bporn", r"\bonlyfans\b", r"\bnsfw\b", r"\bnude[s]?\b"),
    "elections": (r"\belection fraud\b", r"\brigged election\b", r"\bstolen election\b"),
}


@dataclass(frozen=True)
class SafetyVerdict:
    """Outcome of screening one topic title."""

    safe: bool
    category: str = ""
    matched: str = ""

    @property
    def reason(self) -> str:
        if self.safe:
            return ""
        return f"{self.category} (matched {self.matched!r})"


def _compile(extra_terms: tuple[str, ...]) -> list[tuple[str, re.Pattern[str]]]:
    compiled = [
        (category, re.compile(pattern, re.IGNORECASE))
        for category, patterns in _BLOCKED_PATTERNS.items()
        for pattern in patterns
    ]
    compiled.extend(
        ("custom", re.compile(re.escape(term), re.IGNORECASE)) for term in extra_terms if term
    )
    return compiled


def screen(text: str, extra_terms: tuple[str, ...] = ()) -> SafetyVerdict:
    """Screen a topic title/summary; unsafe topics carry the category that tripped."""
    for category, pattern in _compile(tuple(extra_terms)):
        match = pattern.search(text)
        if match:
            return SafetyVerdict(safe=False, category=category, matched=match.group(0))
    return SafetyVerdict(safe=True)


def is_safe(text: str, extra_terms: tuple[str, ...] = ()) -> bool:
    """True when ``text`` clears every blocklist category."""
    return screen(text, extra_terms).safe
