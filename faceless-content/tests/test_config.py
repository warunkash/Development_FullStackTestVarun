"""Tests for configuration loading."""

from __future__ import annotations

import json

import pytest

from faceless_content.config import Config, expand_env, load_config
from faceless_content.errors import ConfigError


def test_defaults_are_usable_without_a_file():
    cfg = load_config(None)
    assert cfg.render.width == 1080 and cfg.render.height == 1920
    assert cfg.script.model == "claude-opus-5"
    assert cfg.publish.targets == []


def test_yaml_overrides_only_the_keys_it_sets(tmp_path):
    path = tmp_path / "config.yaml"
    path.write_text(
        "output_dir: videos\n"
        "script:\n"
        "  target_seconds: 30\n"
        "publish:\n"
        "  targets: [youtube, tiktok]\n"
    )
    cfg = load_config(path)
    assert cfg.output_dir == "videos"
    assert cfg.script.target_seconds == 30
    # Untouched keys keep their defaults.
    assert cfg.script.words_per_second == Config().script.words_per_second
    assert cfg.publish.targets == ["youtube", "tiktok"]


def test_json_config_is_accepted(tmp_path):
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"render": {"fps": 24}}))
    assert load_config(path).render.fps == 24


def test_nested_sections_become_dataclasses(tmp_path):
    path = tmp_path / "config.yaml"
    path.write_text("discovery:\n  geo: IN\n")
    cfg = load_config(path)
    assert cfg.discovery.geo == "IN"
    assert hasattr(cfg.discovery, "weights")


def test_unknown_top_level_key_is_rejected(tmp_path):
    path = tmp_path / "config.yaml"
    path.write_text("nonsense: 1\n")
    with pytest.raises(ConfigError, match="nonsense"):
        load_config(path)


def test_unknown_nested_key_names_its_section(tmp_path):
    path = tmp_path / "config.yaml"
    path.write_text("render:\n  bitrate: high\n")
    with pytest.raises(ConfigError, match="under render"):
        load_config(path)


def test_a_scalar_where_a_section_belongs_is_rejected(tmp_path):
    path = tmp_path / "config.yaml"
    path.write_text("render: 5\n")
    with pytest.raises(ConfigError, match="must be a mapping"):
        load_config(path)


def test_missing_file_is_an_error(tmp_path):
    with pytest.raises(ConfigError, match="not found"):
        load_config(tmp_path / "absent.yaml")


def test_non_mapping_root_is_rejected(tmp_path):
    path = tmp_path / "config.yaml"
    path.write_text("- a\n- b\n")
    with pytest.raises(ConfigError, match="must be a mapping"):
        load_config(path)


def test_env_references_are_expanded(monkeypatch):
    monkeypatch.setenv("MY_KEY", "secret-value")
    assert expand_env("${MY_KEY}") == "secret-value"
    assert expand_env({"a": ["${MY_KEY}"]}) == {"a": ["secret-value"]}


def test_env_reference_falls_back_to_its_default(monkeypatch):
    monkeypatch.delenv("ABSENT_KEY", raising=False)
    assert expand_env("${ABSENT_KEY:-fallback}") == "fallback"
    assert expand_env("${ABSENT_KEY}") == ""


def test_secrets_can_come_from_the_environment(tmp_path, monkeypatch):
    monkeypatch.setenv("YT_KEY", "abc123")
    path = tmp_path / "config.yaml"
    path.write_text("discovery:\n  youtube_api_key: ${YT_KEY}\n")
    assert load_config(path).discovery.youtube_api_key == "abc123"


def test_non_string_values_pass_through_expansion():
    assert expand_env(42) == 42
    assert expand_env(True) is True
