"""Tests for publish target selection and the dry-run path."""

from __future__ import annotations

from pathlib import Path

from faceless_content.config import PublishConfig
from faceless_content.publish import UploadRequest, build_targets, publish_all
from faceless_content.publish.instagram import InstagramTarget
from faceless_content.publish.tiktok import TikTokTarget
from faceless_content.publish.youtube import YouTubeTarget


def _request(tmp_path: Path) -> UploadRequest:
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\x00")
    return UploadRequest(video, "Title", "Description", ["one", "two", "three"])


def test_build_targets_maps_names_and_ignores_unknown_ones():
    targets = build_targets(PublishConfig(targets=["youtube", "tiktok", "instagram", "myspace"]))
    assert [t.name for t in targets] == ["youtube", "tiktok", "instagram"]


def test_build_targets_is_case_insensitive():
    assert [t.name for t in build_targets(PublishConfig(targets=["YouTube"]))] == ["youtube"]


def test_no_targets_means_render_only(tmp_path):
    assert publish_all(_request(tmp_path), PublishConfig()) == []


def test_dry_run_never_calls_a_platform(tmp_path, monkeypatch):
    def explode(*args, **kwargs):
        raise AssertionError("a dry run must not make network calls")

    monkeypatch.setattr(YouTubeTarget, "publish", explode)
    results = publish_all(
        _request(tmp_path), PublishConfig(targets=["youtube"]), dry_run=True
    )
    assert len(results) == 1 and results[0].ok
    assert "dry run" in results[0].detail


def test_dry_run_reports_credentials_that_would_be_missing(tmp_path, monkeypatch):
    for key in YouTubeTarget.required_env:
        monkeypatch.delenv(key, raising=False)
    result = publish_all(_request(tmp_path), PublishConfig(targets=["youtube"]), dry_run=True)[0]
    assert "YOUTUBE_CLIENT_ID" in result.detail


def test_missing_credentials_fail_without_a_network_call(tmp_path, monkeypatch):
    for key in TikTokTarget.required_env:
        monkeypatch.delenv(key, raising=False)
    result = publish_all(_request(tmp_path), PublishConfig(targets=["tiktok"]))[0]
    assert not result.ok
    assert "missing env" in result.detail


def test_instagram_requires_a_public_url(tmp_path, monkeypatch):
    monkeypatch.setenv("INSTAGRAM_USER_ID", "1")
    monkeypatch.setenv("INSTAGRAM_ACCESS_TOKEN", "t")
    result = publish_all(
        _request(tmp_path), PublishConfig(targets=["instagram"], public_base_url="")
    )[0]
    assert not result.ok
    assert "public_base_url" in result.detail


def test_one_failing_target_does_not_block_the_others(tmp_path, monkeypatch):
    from faceless_content.publish.base import PublishResult

    monkeypatch.setattr(
        YouTubeTarget, "publish", lambda self, r, t: PublishResult("youtube", False, detail="boom")
    )
    monkeypatch.setattr(
        TikTokTarget, "publish", lambda self, r, t: PublishResult("tiktok", True, url="http://ok")
    )
    results = publish_all(_request(tmp_path), PublishConfig(targets=["youtube", "tiktok"]))
    assert [r.ok for r in results] == [False, True]


def test_hashtag_line_is_capped(tmp_path):
    request = UploadRequest(tmp_path / "v.mp4", "t", "d", [f"tag{i}" for i in range(20)])
    assert request.hashtag_line(limit=3) == "#tag0 #tag1 #tag2"


def test_target_availability_reflects_the_environment(monkeypatch):
    for key in YouTubeTarget.required_env:
        monkeypatch.setenv(key, "x")
    assert YouTubeTarget().available()
    monkeypatch.delenv("YOUTUBE_REFRESH_TOKEN")
    assert not YouTubeTarget().available()
    assert YouTubeTarget().missing_env() == ["YOUTUBE_REFRESH_TOKEN"]


def test_instagram_normalises_a_trailing_slash():
    assert InstagramTarget("https://cdn.example.com/").public_base_url == "https://cdn.example.com"
