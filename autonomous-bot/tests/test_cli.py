"""Tests for the command-line surface and its exit codes.

Exit codes matter: cron and GitHub Actions decide whether a run failed from
them, so they are part of the contract.
"""

from __future__ import annotations

import json

import pytest

from autobot.cli import EXIT_CONFIG_ERROR, EXIT_INCOMPLETE, EXIT_OK, main

CONFIG = """
policy: rule
workspace: {workspace}
journal_dir: {journal}
tasks:
  - name: good
    objective: succeed
    playbook:
      - tool: finish
        args:
          summary: all good
  - name: bad
    objective: fail
    playbook:
      - tool: read_file
        args:
          path: nope.txt
  - name: "off"
    objective: disabled task
    enabled: false
    playbook:
      - tool: finish
        args:
          summary: never runs
"""


@pytest.fixture()
def config_path(tmp_path):
    path = tmp_path / "autobot.yaml"
    path.write_text(
        CONFIG.format(workspace=str(tmp_path), journal=str(tmp_path / "runs"))
    )
    return str(path)


def run_cli(config_path, *args):
    return main(["-c", config_path, "-q", *args])


class TestRun:
    def test_successful_task_exits_zero(self, config_path, capsys):
        assert run_cli(config_path, "run", "good") == EXIT_OK
        assert "completed" in capsys.readouterr().out

    def test_failed_task_exits_nonzero(self, config_path):
        # A cron job must be able to tell a broken run from a healthy one.
        assert run_cli(config_path, "run", "bad") == EXIT_INCOMPLETE

    def test_unknown_task_is_a_config_error(self, config_path, capsys):
        assert run_cli(config_path, "run", "ghost") == EXIT_CONFIG_ERROR
        assert "no task named" in capsys.readouterr().err

    def test_json_output_is_machine_readable(self, config_path, capsys):
        run_cli(config_path, "run", "good", "--json")
        payload = json.loads(capsys.readouterr().out)
        assert payload["status"] == "completed"
        assert payload["goal"]["name"] == "good"


class TestInspection:
    def test_tasks_lists_enabled_state(self, config_path, capsys):
        assert run_cli(config_path, "tasks") == EXIT_OK
        out = capsys.readouterr().out
        assert "good" in out and "disabled" in out

    def test_tools_hides_dangerous_by_default(self, config_path, capsys):
        assert run_cli(config_path, "tools") == EXIT_OK
        out = capsys.readouterr().out
        assert "write_file" in out
        assert "run_command" not in out

    def test_tools_shows_dangerous_when_enabled(self, config_path, capsys, monkeypatch):
        monkeypatch.setenv("AUTOBOT_ALLOW_DANGEROUS_TOOLS", "true")
        run_cli(config_path, "tools")
        assert "run_command" in capsys.readouterr().out

    def test_doctor_passes_on_a_valid_config(self, config_path, capsys):
        assert run_cli(config_path, "doctor") == EXIT_OK
        assert "all checks passed" in capsys.readouterr().out

    def test_doctor_flags_a_playbookless_task_under_the_rule_policy(self, tmp_path, capsys):
        path = tmp_path / "autobot.yaml"
        path.write_text(
            f"policy: rule\nworkspace: {tmp_path}\ntasks:\n  - name: t\n    objective: o\n"
        )
        assert main(["-c", str(path), "-q", "doctor"]) == EXIT_CONFIG_ERROR
        assert "has no playbook" in capsys.readouterr().out


class TestServe:
    def test_serve_honours_max_cycles(self, config_path, capsys):
        assert run_cli(config_path, "serve", "--max-cycles", "2") == EXIT_OK

    def test_policy_override_applies(self, config_path, capsys, monkeypatch):
        # Selecting the claude policy with no usable credentials must fail
        # cleanly rather than tracebacking. The exact message depends on
        # whether the SDK is installed, so assert the behaviour, not the text.
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
        assert run_cli(config_path, "--policy", "claude", "run", "good") == EXIT_INCOMPLETE
        out = capsys.readouterr().out
        assert "status:  failed" in out
        assert "Policy error:" in out


class TestConfigErrors:
    def test_missing_config_file(self, tmp_path, capsys):
        assert main(["-c", str(tmp_path / "nope.yaml"), "run", "x"]) == EXIT_CONFIG_ERROR
        assert "config error" in capsys.readouterr().err
