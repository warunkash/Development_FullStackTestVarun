"""Tests for the daemon: scheduling, backoff, crash isolation and shutdown."""

from __future__ import annotations

import threading
import time

import pytest

from autobot.config import BotConfig, TaskSpec
from autobot.models import Action
from autobot.policy import BasePolicy
from autobot.runner import MAX_BACKOFF_S, Runner, ScheduledTask, build_registry, run_id_for, run_once


def config_with(playbook, **overrides) -> BotConfig:
    raw = {
        "policy": "rule",
        "journal_dir": overrides.pop("journal_dir", "runs"),
        "workspace": overrides.pop("workspace", "."),
        "tasks": [
            {
                "name": "quick",
                "objective": "do it",
                "interval_s": 0.01,
                "max_steps": 5,
                "playbook": playbook,
                **overrides,
            }
        ],
    }
    return BotConfig.from_dict(raw)


FINISHING = [{"tool": "finish", "args": {"summary": "ok"}}]
FAILING = [{"tool": "read_file", "args": {"path": "does-not-exist.txt"}}]


class TestRunOnce:
    def test_runs_named_task_and_writes_journal(self, tmp_path):
        config = config_with(FINISHING, workspace=str(tmp_path), journal_dir=str(tmp_path / "runs"))
        result = run_once(config, "quick")

        assert result.status == "completed"
        journals = list((tmp_path / "runs").glob("quick-*.jsonl"))
        assert len(journals) == 1

    def test_unknown_task_raises_config_error(self, tmp_path):
        from autobot.config import ConfigError

        config = config_with(FINISHING, workspace=str(tmp_path))
        with pytest.raises(ConfigError, match="no task named"):
            run_once(config, "ghost")


class TestRunIds:
    def test_is_filesystem_safe_and_prefixed(self):
        run_id = run_id_for("weird/name with spaces")
        assert "/" not in run_id and " " not in run_id
        assert run_id.startswith("weird-name-with-spaces-")


class TestRegistryGate:
    def test_dangerous_tools_are_off_by_default(self):
        assert "run_command" not in build_registry(BotConfig())

    def test_dangerous_tools_can_be_enabled(self):
        assert "run_command" in build_registry(BotConfig(allow_dangerous_tools=True))

    def test_extra_tools_are_registered(self):
        from autobot.tools import tool

        @tool
        def custom() -> str:
            """A project-specific tool."""
            return "x"

        assert "custom" in build_registry(BotConfig(), extra_tools=[custom])


class TestBackoff:
    def test_success_uses_the_plain_interval(self):
        task = ScheduledTask(spec=TaskSpec(name="t", objective="o", interval_s=60))
        assert task.delay_after(ok=True) == 60

    def test_failure_grows_exponentially(self):
        task = ScheduledTask(spec=TaskSpec(name="t", objective="o", interval_s=10))
        # jitter fixed at 0.5 -> multiplier of exactly 1.0
        task.consecutive_failures = 1
        assert task.delay_after(ok=False, jitter=lambda: 0.5) == pytest.approx(20)
        task.consecutive_failures = 3
        assert task.delay_after(ok=False, jitter=lambda: 0.5) == pytest.approx(80)

    def test_backoff_is_capped(self):
        task = ScheduledTask(spec=TaskSpec(name="t", objective="o", interval_s=600))
        task.consecutive_failures = 8
        assert task.delay_after(ok=False, jitter=lambda: 0.5) == pytest.approx(MAX_BACKOFF_S)

    def test_jitter_spreads_retries(self):
        task = ScheduledTask(spec=TaskSpec(name="t", objective="o", interval_s=10))
        task.consecutive_failures = 1
        assert task.delay_after(ok=False, jitter=lambda: 0.0) == pytest.approx(15)
        assert task.delay_after(ok=False, jitter=lambda: 1.0) == pytest.approx(25)


class TestServeLoop:
    def test_runs_up_to_max_cycles(self, tmp_path):
        config = config_with(FINISHING, workspace=str(tmp_path), journal_dir=str(tmp_path / "runs"))
        runner = Runner(config)
        results = runner.serve(max_cycles=3)

        assert len(results) == 3
        assert all(r.ok for r in results)
        assert runner.tasks[0].runs == 3

    def test_failed_run_increments_failures_and_backs_off(self, tmp_path):
        config = config_with(FAILING, workspace=str(tmp_path), journal_dir=str(tmp_path / "runs"))
        runner = Runner(config)
        runner.serve(max_cycles=2)

        task = runner.tasks[0]
        assert task.last_status == "failed"
        assert task.consecutive_failures == 2
        # The next run is pushed well past the plain 0.01s interval.
        assert task.next_run_at - time.monotonic() > 0.01

    def test_task_crash_does_not_stop_the_daemon(self, tmp_path):
        class Exploding(BasePolicy):
            def reset(self, goal, registry):
                raise RuntimeError("policy could not start")

            def propose(self, goal, steps, registry):  # pragma: no cover - never reached
                return Action(tool="finish", args={"summary": "unreachable"})

        config = config_with(FINISHING, workspace=str(tmp_path), journal_dir=str(tmp_path / "runs"))
        runner = Runner(config, policy_factory=lambda spec: Exploding())
        runner.serve(max_cycles=2)

        task = runner.tasks[0]
        assert task.runs == 2  # kept going despite both runs crashing
        assert "crashed" in (task.last_status or "")

    def test_no_enabled_tasks_returns_immediately(self, tmp_path):
        config = BotConfig.from_dict(
            {"tasks": [{"name": "off", "objective": "x", "enabled": False}]}
        )
        assert Runner(config).serve(max_cycles=5) == []

    def test_request_stop_ends_the_loop(self, tmp_path):
        config = config_with(
            FINISHING, workspace=str(tmp_path), journal_dir=str(tmp_path / "runs")
        )
        config.tasks[0].interval_s = 30  # long enough that the loop must be waiting
        runner = Runner(config)

        threading.Timer(0.2, runner.request_stop).start()
        start = time.monotonic()
        results = runner.serve()
        elapsed = time.monotonic() - start

        # First run happens immediately, then the loop waits on the interval and
        # is interrupted by the stop rather than sleeping the full 30s.
        assert len(results) == 1
        assert elapsed < 5

    def test_stop_before_start_runs_nothing(self, tmp_path):
        config = config_with(FINISHING, workspace=str(tmp_path), journal_dir=str(tmp_path / "runs"))
        runner = Runner(config)
        runner.request_stop()
        assert runner.serve() == []

    def test_multiple_tasks_are_interleaved(self, tmp_path):
        config = BotConfig.from_dict(
            {
                "policy": "rule",
                "workspace": str(tmp_path),
                "journal_dir": str(tmp_path / "runs"),
                "tasks": [
                    {"name": "a", "objective": "x", "interval_s": 0.01, "playbook": FINISHING},
                    {"name": "b", "objective": "y", "interval_s": 0.01, "playbook": FINISHING},
                ],
            }
        )
        runner = Runner(config)
        results = runner.serve(max_cycles=4)
        names = {r.goal.name for r in results}
        assert names == {"a", "b"}
        assert all(t.runs >= 1 for t in runner.tasks)
