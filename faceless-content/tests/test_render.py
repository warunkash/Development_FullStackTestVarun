"""Tests for the ffmpeg command builders and visual planning."""

from __future__ import annotations

import pytest

from faceless_content.config import RenderConfig, VisualsConfig
from faceless_content.errors import VisualsError
from faceless_content.render import build_assemble_command, build_segment_command
from faceless_content.visuals import _hex_to_ffmpeg, plan_durations, select_providers


def _flag(cmd: list[str], flag: str) -> str:
    return cmd[cmd.index(flag) + 1]


def test_segment_command_scales_crops_and_pins_the_duration():
    cmd = build_segment_command("src00.mp4", "seg00.mp4", 3.5, RenderConfig())
    assert _flag(cmd, "-t") == "3.500"
    assert _flag(cmd, "-i") == "src00.mp4"
    video_filter = _flag(cmd, "-vf")
    assert "scale=1080:1920:force_original_aspect_ratio=increase" in video_filter
    assert "crop=1080:1920" in video_filter
    assert "fps=30" in video_filter
    assert cmd[-1] == "seg00.mp4"


def test_segment_command_loops_a_short_source_to_fill_its_slot():
    cmd = build_segment_command("src.mp4", "seg.mp4", 10.0, RenderConfig())
    # -stream_loop must precede -i to apply to that input.
    assert cmd.index("-stream_loop") < cmd.index("-i")
    assert _flag(cmd, "-stream_loop") == "-1"


def test_segment_command_honours_render_settings():
    cfg = RenderConfig(width=720, height=1280, fps=24, crf=18, preset="slow")
    cmd = build_segment_command("s.mp4", "o.mp4", 2.0, cfg)
    assert "scale=720:1280" in _flag(cmd, "-vf")
    assert "fps=24" in _flag(cmd, "-vf")
    assert _flag(cmd, "-crf") == "18"
    assert _flag(cmd, "-preset") == "slow"


def test_assemble_burns_subtitles_and_normalises_speech():
    cmd = build_assemble_command(
        "segments.txt", "voice.wav", "final.mp4", RenderConfig(), subtitles_name="captions.ass"
    )
    filters = _flag(cmd, "-filter_complex")
    assert "[0:v]subtitles=captions.ass[v]" in filters
    assert "loudnorm" in filters
    assert cmd[cmd.index("-map") + 1] == "[v]"
    # Burning captions requires a video re-encode, so copy must not be used.
    assert "copy" not in cmd


def test_assemble_copies_the_video_stream_when_there_are_no_captions():
    cmd = build_assemble_command("segments.txt", "voice.wav", "final.mp4", RenderConfig())
    assert "-c:v" in cmd and _flag(cmd, "-c:v") == "copy"
    assert cmd[cmd.index("-map") + 1] == "0:v"
    assert "subtitles=" not in _flag(cmd, "-filter_complex")


def test_assemble_mixes_and_loops_background_music():
    cfg = RenderConfig(music_volume=0.2)
    cmd = build_assemble_command(
        "segments.txt", "voice.wav", "final.mp4", cfg, music_name="music.mp3"
    )
    filters = _flag(cmd, "-filter_complex")
    assert "volume=0.2" in filters
    assert "amix=inputs=2" in filters
    # The bed loops so a short track still covers the video.
    assert cmd.index("-stream_loop") < cmd.index("music.mp3")


def test_assemble_always_uses_the_concat_demuxer_safely():
    cmd = build_assemble_command("segments.txt", "voice.wav", "final.mp4", RenderConfig())
    assert cmd[cmd.index("-f") + 1] == "concat"
    assert "-safe" in cmd and _flag(cmd, "-safe") == "0"
    assert "-shortest" in cmd
    assert _flag(cmd, "-pix_fmt") == "yuv420p"


def test_plan_durations_covers_the_whole_voiceover():
    durations = plan_durations(10.0, 3)
    assert len(durations) == 3
    assert sum(durations) == pytest.approx(10.0)


def test_plan_durations_gives_a_fixed_slot_the_remainder_on_the_last_clip():
    durations = plan_durations(10.0, 3, per_beat=2.0)
    assert durations[:2] == [2.0, 2.0]
    assert sum(durations) == pytest.approx(10.0)


def test_plan_durations_with_one_clip():
    assert plan_durations(7.5, 1) == pytest.approx([7.5])


def test_plan_durations_rejects_zero_clips():
    with pytest.raises(VisualsError):
        plan_durations(10.0, 0)


@pytest.mark.parametrize(
    ("value", "expected"), [("#12002E", "0x12002e"), ("5b0f8b", "0x5b0f8b")]
)
def test_hex_to_ffmpeg(value, expected):
    assert _hex_to_ffmpeg(value) == expected


@pytest.mark.parametrize("value", ["#12", "not-a-colour", "#12002g"])
def test_hex_to_ffmpeg_rejects_bad_colours(value):
    with pytest.raises(VisualsError):
        _hex_to_ffmpeg(value)


def test_gradient_provider_is_always_available(monkeypatch):
    monkeypatch.delenv("PEXELS_API_KEY", raising=False)
    assert [p.name for p in select_providers(VisualsConfig(provider="auto"))] == ["gradient"]


def test_pexels_is_preferred_when_a_key_exists(monkeypatch):
    monkeypatch.setenv("PEXELS_API_KEY", "k")
    names = [p.name for p in select_providers(VisualsConfig(provider="auto"))]
    assert names == ["pexels", "gradient"]


def test_unknown_provider_is_rejected():
    with pytest.raises(VisualsError):
        select_providers(VisualsConfig(provider="nope"))
