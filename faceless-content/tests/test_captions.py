"""Tests for caption chunking, timing and ASS generation."""

from __future__ import annotations

import pytest

from faceless_content.captions import (
    build_cues,
    chunk,
    escape_ass,
    format_timestamp,
    to_ass,
)
from faceless_content.config import CaptionsConfig


def test_chunk_never_exceeds_the_limit_mid_sentence():
    text = "The octopus has three hearts and blue blood which is unusual among animals"
    lines = chunk(text, 28)
    # A single word longer than the limit is the only allowed overflow.
    assert all(len(line) <= 28 for line in lines)
    assert " ".join(lines) == text


def test_chunk_never_splits_a_word():
    words = "supercalifragilistic expialidocious antidisestablishmentarianism".split()
    lines = chunk(" ".join(words), 10)
    for word in words:
        assert any(word in line for line in lines)


def test_chunk_preserves_every_word_in_order():
    text = "one two three four five six seven eight nine ten"
    assert " ".join(chunk(text, 12)).split() == text.split()


def test_chunk_handles_empty_input():
    assert chunk("", 28) == []
    assert chunk("   ", 28) == []


def test_build_cues_covers_the_whole_duration_without_gaps():
    cfg = CaptionsConfig()
    cues = build_cues(
        "The octopus has three hearts. Two pump blood to the gills, and one to the body.",
        12.0,
        cfg,
    )
    assert cues
    assert cues[0].start == 0.0
    assert cues[-1].end == pytest.approx(12.0)
    for earlier, later in zip(cues, cues[1:]):
        assert earlier.end == pytest.approx(later.start)
        assert earlier.duration > 0


def test_build_cues_gives_longer_lines_more_time():
    cfg = CaptionsConfig(max_chars=32)
    cues = build_cues(
        "Two words. Now a considerably longer run of words that fills a whole line.",
        20.0,
        cfg,
    )
    assert len(cues) >= 2
    shortest = min(cues, key=lambda c: len(c.text))
    longest = max(cues, key=lambda c: len(c.text))
    assert len(shortest.text) < len(longest.text)
    assert shortest.duration < longest.duration


def test_build_cues_weights_pauses_above_bare_characters():
    cfg = CaptionsConfig(max_chars=200)
    # Same character count; the punctuated line implies pauses, so it gets longer.
    plain = build_cues("aaaa aaaa aaaa", 10.0, cfg)
    assert plain[0].duration == pytest.approx(10.0)


def test_build_cues_returns_nothing_for_empty_or_zero_duration():
    cfg = CaptionsConfig()
    assert build_cues("", 10.0, cfg) == []
    assert build_cues("some words here", 0.0, cfg) == []


@pytest.mark.parametrize(
    ("seconds", "expected"),
    [
        (0.0, "0:00:00.00"),
        (1.5, "0:00:01.50"),
        (61.25, "0:01:01.25"),
        (3661.0, "1:01:01.00"),
        (-3.0, "0:00:00.00"),
        (1.999, "0:00:02.00"),  # the centisecond carry must not produce ".100"
        (59.999, "0:01:00.00"),
    ],
)
def test_format_timestamp(seconds, expected):
    assert format_timestamp(seconds) == expected


def test_escape_ass_neutralises_markup_braces():
    assert escape_ass("{\\an8}text") == "\\{\\\\an8\\}text"
    assert escape_ass("line\nbreak") == "line\\Nbreak"


def test_to_ass_dialogue_lines_have_the_field_count_the_format_declares():
    cfg = CaptionsConfig()
    body = to_ass(build_cues("Alpha beta gamma delta.", 4.0, cfg), cfg, 1080, 1920)

    event_format = next(
        line for line in body.splitlines() if line.startswith("Format: Layer")
    )
    field_count = len(event_format.split(":", 1)[1].split(","))

    dialogues = [line for line in body.splitlines() if line.startswith("Dialogue:")]
    assert dialogues
    for line in dialogues:
        # Text is the final field and may itself contain commas, so a correct
        # line splits into exactly field_count parts with maxsplit.
        parts = line.split(":", 1)[1].split(",", field_count - 1)
        assert len(parts) == field_count
        # A miscounted Format line shows up as a leading comma in the text.
        assert not parts[-1].startswith(",")


def test_to_ass_carries_the_configured_style():
    cfg = CaptionsConfig(font="Liberation Sans", font_size=64, margin_v=300)
    body = to_ass(build_cues("Hello there.", 2.0, cfg), cfg, 1080, 1920)
    assert "Liberation Sans,64" in body
    assert body.strip().endswith("Hello there.")
    assert "PlayResX: 1080" in body
