"""Tests for config parsing, validation and environment overrides."""

from __future__ import annotations

import json

import pytest

from autobot.config import BotConfig, ConfigError, TaskSpec, load_config, load_raw

MINIMAL = {
    "policy": "rule",
    "tasks": [{"name": "t1", "objective": "do a thing"}],
}


class TestTaskSpec:
    def test_defaults(self):
        spec = TaskSpec.from_dict({"name": "t", "objective": "o"})
        assert spec.max_steps == 12
        assert spec.enabled is True
        assert spec.playbook == []

    def test_requires_name_and_objective(self):
        with pytest.raises(ConfigError, match="missing required key"):
            TaskSpec.from_dict({"name": "t"})

    def test_explains_yaml_boolean_names(self):
        # `name: off` in YAML parses as False; the error must point at that.
        with pytest.raises(ConfigError, match="read False as a boolean"):
            TaskSpec.from_dict({"name": False, "objective": "o"})

    def test_rejects_unknown_key(self):
        with pytest.raises(ConfigError, match="unknown key"):
            TaskSpec.from_dict({"name": "t", "objective": "o", "colour": "red"})

    def test_converts_to_goal(self):
        goal = TaskSpec.from_dict(
            {"name": "t", "objective": "o", "max_steps": 3, "playbook": [{"tool": "finish"}]}
        ).to_goal()
        assert goal.name == "t"
        assert goal.max_steps == 3
        assert goal.playbook == [{"tool": "finish"}]


class TestBotConfig:
    def test_parses_minimal(self):
        config = BotConfig.from_dict(MINIMAL)
        assert config.policy == "rule"
        assert len(config.tasks) == 1

    def test_rejects_unknown_top_level_key(self):
        with pytest.raises(ConfigError, match="unknown config key"):
            BotConfig.from_dict({"polcy": "rule"})

    def test_rejects_duplicate_task_names(self):
        with pytest.raises(ConfigError, match="duplicate task name"):
            BotConfig.from_dict(
                {"tasks": [{"name": "a", "objective": "x"}, {"name": "a", "objective": "y"}]}
            )

    def test_task_lookup_lists_known_names(self):
        config = BotConfig.from_dict(MINIMAL)
        assert config.task("t1").objective == "do a thing"
        with pytest.raises(ConfigError, match="known tasks: t1"):
            config.task("missing")

    def test_enabled_tasks_filters(self):
        config = BotConfig.from_dict(
            {
                "tasks": [
                    {"name": "on", "objective": "x"},
                    {"name": "off", "objective": "y", "enabled": False},
                ]
            }
        )
        assert [t.name for t in config.enabled_tasks] == ["on"]

    def test_domains_are_lowercased(self):
        config = BotConfig.from_dict({"allowed_domains": ["API.GitHub.COM"]})
        assert config.allowed_domains == ["api.github.com"]


class TestEnvOverrides:
    def test_policy_and_workspace(self, monkeypatch):
        monkeypatch.setenv("AUTOBOT_POLICY", "claude")
        monkeypatch.setenv("AUTOBOT_WORKSPACE", "/tmp/ws")
        config = BotConfig.from_dict(MINIMAL)
        assert config.policy == "claude"
        assert config.workspace == "/tmp/ws"

    def test_allowed_domains_list(self, monkeypatch):
        monkeypatch.setenv("AUTOBOT_ALLOWED_DOMAINS", "a.com, B.com ,")
        config = BotConfig.from_dict(MINIMAL)
        assert config.allowed_domains == ["a.com", "b.com"]

    def test_dangerous_tools_flag(self, monkeypatch):
        monkeypatch.setenv("AUTOBOT_ALLOW_DANGEROUS_TOOLS", "true")
        assert BotConfig.from_dict(MINIMAL).allow_dangerous_tools is True
        monkeypatch.setenv("AUTOBOT_ALLOW_DANGEROUS_TOOLS", "no")
        assert BotConfig.from_dict(MINIMAL).allow_dangerous_tools is False


class TestLoading:
    def test_loads_yaml(self, tmp_path):
        path = tmp_path / "autobot.yaml"
        path.write_text("policy: rule\ntasks:\n  - name: t\n    objective: o\n")
        config = load_config(path)
        assert config.task("t").objective == "o"

    def test_loads_json(self, tmp_path):
        path = tmp_path / "autobot.json"
        path.write_text(json.dumps(MINIMAL))
        assert load_config(path).task("t1").name == "t1"

    def test_missing_file_is_a_config_error(self, tmp_path):
        with pytest.raises(ConfigError, match="not found"):
            load_raw(tmp_path / "nope.yaml")

    def test_invalid_yaml_is_a_config_error(self, tmp_path):
        path = tmp_path / "bad.yaml"
        path.write_text("tasks: [unclosed\n")
        with pytest.raises(ConfigError, match="invalid YAML"):
            load_raw(path)

    def test_invalid_json_is_a_config_error(self, tmp_path):
        path = tmp_path / "bad.json"
        path.write_text("{not json")
        with pytest.raises(ConfigError, match="invalid JSON"):
            load_raw(path)

    def test_search_reports_where_it_looked(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        with pytest.raises(ConfigError, match="no config file given"):
            load_config()

    def test_search_finds_default_name(self, tmp_path, monkeypatch):
        (tmp_path / "autobot.yaml").write_text("tasks:\n  - name: t\n    objective: o\n")
        monkeypatch.chdir(tmp_path)
        assert load_config().task("t").name == "t"


class TestShippedConfig:
    def test_repo_config_is_valid(self):
        """The autobot.yaml committed alongside the package must actually load."""
        from pathlib import Path

        path = Path(__file__).resolve().parent.parent / "autobot.yaml"
        config = load_config(path)
        assert config.task("heartbeat").playbook
        assert config.task("heartbeat").playbook[-1]["tool"] == "finish"
