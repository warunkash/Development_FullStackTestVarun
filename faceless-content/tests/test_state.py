"""Tests for the topic-history store."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from faceless_content.state import State, topic_key


def test_topic_key_ignores_case_punctuation_and_word_order():
    assert topic_key("The Rise of a New Octopus!") == topic_key("octopus rise new")


def test_topic_key_drops_stopwords():
    assert topic_key("The history of the paperclip") == "history paperclip"


def test_topic_key_strips_accents():
    assert topic_key("Café culture") == topic_key("Cafe culture")


def test_topic_key_of_only_stopwords_is_empty():
    assert topic_key("the of and") == ""


def test_record_then_reload_round_trips(tmp_path):
    path = tmp_path / "state.json"
    state = State(path)
    state.record("Why the ocean is salty", "/videos/ocean.mp4", {"youtube": "http://y/1"})

    reloaded = State(path)
    assert len(reloaded.entries) == 1
    assert reloaded.entries[0].title == "Why the ocean is salty"
    assert reloaded.entries[0].published == {"youtube": "http://y/1"}


def test_used_recently_matches_a_reworded_title(tmp_path):
    state = State(tmp_path / "state.json")
    state.record("The Octopus Heart")
    assert state.used_recently("octopus heart", cooldown_days=30)


def test_used_recently_expires_after_the_cooldown(tmp_path):
    state = State(tmp_path / "state.json")
    state.record("Octopus", now=datetime.now(timezone.utc) - timedelta(days=31))
    assert not state.used_recently("Octopus", cooldown_days=30)
    assert state.used_recently("Octopus", cooldown_days=60)


def test_cooldown_of_zero_disables_the_check(tmp_path):
    state = State(tmp_path / "state.json")
    state.record("Octopus")
    assert not state.used_recently("Octopus", cooldown_days=0)


def test_unknown_topic_is_not_recent(tmp_path):
    state = State(tmp_path / "state.json")
    state.record("Octopus")
    assert not state.used_recently("Volcanoes", cooldown_days=30)


def test_a_corrupt_state_file_does_not_crash_the_run(tmp_path):
    path = tmp_path / "state.json"
    path.write_text("{not valid json")
    state = State(path)
    assert state.entries == []
    # It must still be writable afterwards.
    state.record("Octopus")
    assert State(path).entries


def test_missing_state_file_starts_empty(tmp_path):
    assert State(tmp_path / "nested" / "state.json").entries == []


def test_save_creates_parent_directories(tmp_path):
    state = State(tmp_path / "a" / "b" / "state.json")
    state.record("Octopus")
    assert (tmp_path / "a" / "b" / "state.json").exists()


def test_naive_timestamps_are_treated_as_utc(tmp_path):
    path = tmp_path / "state.json"
    path.write_text(
        '{"entries": [{"key": "octopus", "title": "Octopus", '
        '"created_at": "2999-01-01T00:00:00"}]}'
    )
    assert State(path).used_recently("Octopus", cooldown_days=30)
