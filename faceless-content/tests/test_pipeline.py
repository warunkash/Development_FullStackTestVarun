"""Tests for the orchestrator, including one real end-to-end render."""

from __future__ import annotations

import json
import shutil

import pytest

from faceless_content.config import Config
from faceless_content.discovery import Topic
from faceless_content.pipeline import build_description, run, slugify
from faceless_content.scripting import VideoScript
from faceless_content.state import State

needs_ffmpeg = pytest.mark.skipif(
    not (shutil.which("ffmpeg") and shutil.which("ffprobe")),
    reason="ffmpeg and ffprobe are required for the render test",
)
needs_espeak = pytest.mark.skipif(
    not shutil.which("espeak-ng"), reason="espeak-ng is required for the offline voice test"
)


@pytest.mark.parametrize(
    ("title", "expected"),
    [
        ("Why the ocean is salty", "why-the-ocean-is-salty"),
        ("  Multiple   spaces!  ", "multiple-spaces"),
        ("C++ & Rust: a comparison", "c-rust-a-comparison"),
        ("", "untitled"),
        ("!!!", "untitled"),
    ],
)
def test_slugify(title, expected):
    assert slugify(title) == expected


def test_slugify_truncates_without_a_trailing_dash():
    slug = slugify("a" * 40 + " " + "b" * 40, max_length=45)
    assert len(slug) <= 45
    assert not slug.endswith("-")


def test_build_description_includes_the_source_and_hashtags():
    cfg = Config()
    cfg.publish.description_footer = "Made automatically."
    script = VideoScript(
        topic="Ocean", title="Ocean", hook="The ocean was not always salty.",
        beats=["a"], hashtags=["science", "ocean"],
    )
    topic = Topic(title="Ocean", score=1.0, url="https://example.com/ocean")

    description = build_description(script, topic, cfg)
    assert "The ocean was not always salty." in description
    assert "https://example.com/ocean" in description
    assert "Made automatically." in description
    assert "#science #ocean" in description


def test_build_description_caps_the_hashtag_count():
    cfg = Config()
    cfg.publish.hashtag_limit = 2
    script = VideoScript(
        topic="t", title="t", hook="Hook.", hashtags=["a", "b", "c", "d"]
    )
    assert build_description(script, None, cfg).count("#") == 2


def test_build_description_omits_absent_parts():
    script = VideoScript(topic="t", title="t", hook="Hook.")
    assert build_description(script, None, Config()) == "Hook."


@needs_ffmpeg
@needs_espeak
def test_run_produces_a_playable_video_and_metadata(tmp_path):
    """The whole pipeline, using only the offline voice and gradient visuals."""
    from faceless_content.ffmpeg import probe_duration

    cfg = Config()
    cfg.output_dir = str(tmp_path / "out")
    cfg.state_path = str(tmp_path / "state.json")
    cfg.script.writer = "template"
    cfg.voice.backend = "espeak"
    cfg.visuals.provider = "gradient"
    cfg.visuals.max_clips = 2
    cfg.render.preset = "ultrafast"

    result = run(
        cfg,
        dry_run=True,
        topic_override="Why the ocean is salty",
        summary_override=(
            "Rain weathers rock and rivers carry dissolved salt to the sea. "
            "Water evaporates but the salt stays behind."
        ),
    )

    assert result.video_path.exists()
    assert result.video_path.stat().st_size > 0
    assert result.duration > 1.0
    # The rendered file must match the duration the pipeline reported.
    assert probe_duration(result.video_path) == pytest.approx(result.duration, abs=0.2)

    metadata = json.loads((result.run_dir / "metadata.json").read_text())
    assert metadata["topic"] == "Why the ocean is salty"
    assert metadata["dry_run"] is True
    assert metadata["script"]["beats"]

    # A dry run must stay repeatable, so it must not consume the topic.
    assert State(cfg.state_path).entries == []


@needs_ffmpeg
@needs_espeak
def test_a_real_publish_run_records_the_topic(tmp_path):
    cfg = Config()
    cfg.output_dir = str(tmp_path / "out")
    cfg.state_path = str(tmp_path / "state.json")
    cfg.script.writer = "template"
    cfg.voice.backend = "espeak"
    cfg.visuals.provider = "gradient"
    cfg.visuals.max_clips = 1
    cfg.render.preset = "ultrafast"
    cfg.captions.enabled = False  # exercise the copy-video path

    result = run(cfg, dry_run=False, topic_override="The history of the paperclip")

    assert result.video_path.exists()
    assert result.publish_results == []  # no targets configured
    state = State(cfg.state_path)
    assert len(state.entries) == 1
    assert state.used_recently("history of the paperclip", cooldown_days=30)
