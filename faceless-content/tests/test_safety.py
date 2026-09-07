"""Tests for the brand-safety gate."""

from __future__ import annotations

import pytest

from faceless_content.safety import is_safe, screen


@pytest.mark.parametrize(
    "title",
    [
        "Why the ocean is salty",
        "How sourdough starter actually works",
        "The history of the paperclip",
        "Deadline for tax filing extended",  # 'dead' inside a word must not trip
    ],
)
def test_ordinary_topics_pass(title):
    assert is_safe(title)


@pytest.mark.parametrize(
    ("title", "category"),
    [
        ("Six dead after building collapse", "death"),
        ("Mass shooting at shopping centre", "violence"),
        ("Airstrike hits the capital", "conflict"),
        ("Magnitude 7 earthquake strikes coast", "disaster"),
        ("Star dies at 84", "death"),
        ("Miracle cure for diabetes", "medical_claims"),
    ],
)
def test_sensitive_topics_are_blocked_with_a_category(title, category):
    verdict = screen(title)
    assert not verdict.safe
    assert verdict.category == category
    assert verdict.matched


def test_extra_terms_extend_the_blocklist():
    assert is_safe("Our competitor launches a product")
    verdict = screen("Our competitor launches a product", ("competitor",))
    assert not verdict.safe
    assert verdict.category == "custom"


def test_extra_terms_are_matched_literally_not_as_regex():
    # A regex metacharacter must not blow up or match everything.
    assert is_safe("anything at all", ("c++ (",))


def test_safe_verdict_has_no_reason():
    assert screen("A calm topic").reason == ""
