"""Tests for the plan -> act -> observe loop and its stop conditions."""

from __future__ import annotations

import json

import pytest

from autobot.agent import Agent
from autobot.builtins import default_registry
from autobot.memory import Journal
from autobot.models import Action, Goal, Step
from autobot.policy import BasePolicy, RulePolicy
from autobot.tools import ToolRegistry, tool


@tool
def echo(text: str) -> str:
    """Return the text unchanged.

    Args:
        text: Anything.
    """
    return text


@tool
def always_fails() -> str:
    """Raise every time it is called."""
    raise RuntimeError("this tool is broken")


def registry_with_extras() -> ToolRegistry:
    registry = default_registry()
    registry.add(echo)
    registry.add(always_fails)
    return registry


class LoopingPolicy(BasePolicy):
    """Proposes the same action forever - used to exercise the budgets."""

    def __init__(self, action: Action) -> None:
        self.action = action
        self.observed: list[Step] = []

    def propose(self, goal, steps, registry):
        return self.action

    def observe(self, step: Step) -> None:
        self.observed.append(step)


def make_agent(policy, tmp_path, **kwargs) -> Agent:
    return Agent(
        policy=policy, registry=registry_with_extras(), workspace=str(tmp_path), **kwargs
    )


class TestPlaybookRuns:
    def test_completes_and_reports_summary(self, tmp_path):
        goal = Goal(
            name="demo",
            objective="say hello",
            playbook=[
                {"tool": "echo", "args": {"text": "hello"}},
                {"tool": "finish", "args": {"summary": "said hello"}},
            ],
        )
        result = make_agent(RulePolicy(), tmp_path).run(goal)

        assert result.status == "completed"
        assert result.ok
        assert result.summary == "said hello"
        assert [s.action.tool for s in result.steps] == ["echo", "finish"]
        assert result.failures == 0

    def test_finishes_when_playbook_runs_out(self, tmp_path):
        goal = Goal(
            name="demo",
            objective="one step",
            playbook=[{"tool": "echo", "args": {"text": "hi"}}],
        )
        result = make_agent(RulePolicy(), tmp_path).run(goal)
        # The policy synthesises a finish rather than stalling.
        assert result.status == "completed"
        assert result.steps[-1].action.tool == "finish"

    def test_template_references_previous_output(self, tmp_path):
        goal = Goal(
            name="demo",
            objective="chain",
            playbook=[
                {"tool": "echo", "args": {"text": "first"}},
                {"tool": "echo", "args": {"text": "got: {{last_output}}"}},
                {"tool": "echo", "args": {"text": "step0: {{steps[0].output}}"}},
                {"tool": "finish", "args": {"summary": "done"}},
            ],
        )
        result = make_agent(RulePolicy(), tmp_path).run(goal)
        assert result.steps[1].observation.output == "got: first"
        assert result.steps[2].observation.output == "step0: first"

    def test_template_reads_context_and_env(self, tmp_path, monkeypatch):
        monkeypatch.setenv("AUTOBOT_TEST_VALUE", "from-env")
        goal = Goal(
            name="demo",
            objective="templating",
            context={"who": "world"},
            playbook=[
                {"tool": "echo", "args": {"text": "{{context.who}}/{{env.AUTOBOT_TEST_VALUE}}"}},
                {"tool": "finish", "args": {"summary": "done"}},
            ],
        )
        result = make_agent(RulePolicy(), tmp_path).run(goal)
        assert result.steps[0].observation.output == "world/from-env"


class TestStopConditions:
    def test_stops_at_max_steps(self, tmp_path):
        policy = LoopingPolicy(Action(tool="echo", args={"text": "again"}))
        goal = Goal(name="loop", objective="never finish", max_steps=4)
        result = make_agent(policy, tmp_path).run(goal)

        assert result.status == "max_steps"
        assert len(result.steps) == 4

    def test_stops_at_deadline(self, tmp_path):
        policy = LoopingPolicy(Action(tool="echo", args={"text": "x"}))
        goal = Goal(name="loop", objective="never finish", max_steps=10_000, deadline_s=0.05)
        result = make_agent(policy, tmp_path).run(goal)

        assert result.status == "deadline"
        assert len(result.steps) < 10_000

    def test_gives_up_after_consecutive_failures(self, tmp_path):
        policy = LoopingPolicy(Action(tool="always_fails", args={}))
        goal = Goal(name="broken", objective="fail", max_steps=50)
        result = make_agent(policy, tmp_path, failure_limit=3).run(goal)

        assert result.status == "failed"
        assert len(result.steps) == 3
        assert "consecutive failures" in result.summary

    def test_failure_streak_resets_on_success(self, tmp_path):
        class Alternating(BasePolicy):
            def propose(self, goal, steps, registry):
                if len(steps) >= 6:
                    return Action(tool="finish", args={"summary": "survived"})
                tool_name = "always_fails" if len(steps) % 2 == 0 else "echo"
                return Action(tool=tool_name, args={} if tool_name == "always_fails" else {"text": "ok"})

        result = make_agent(Alternating(), tmp_path, failure_limit=3).run(
            Goal(name="mixed", objective="alternate", max_steps=20)
        )
        # Failures never reach three in a row, so the run gets to finish.
        assert result.status == "completed"
        assert result.summary == "survived"

    def test_policy_error_is_reported_not_raised(self, tmp_path):
        class Exploding(BasePolicy):
            def propose(self, goal, steps, registry):
                raise ValueError("policy is broken")

        result = make_agent(Exploding(), tmp_path).run(Goal(name="x", objective="y"))
        assert result.status == "failed"
        assert "policy is broken" in result.summary


class TestErrorHandling:
    def test_tool_exception_becomes_observation(self, tmp_path):
        policy = LoopingPolicy(Action(tool="always_fails", args={}))
        result = make_agent(policy, tmp_path, failure_limit=1).run(
            Goal(name="x", objective="y", max_steps=1)
        )
        observation = result.steps[0].observation
        assert observation.ok is False
        assert "RuntimeError" in (observation.error or "")

    def test_unknown_tool_is_a_failed_step(self, tmp_path):
        policy = LoopingPolicy(Action(tool="nonexistent", args={}))
        result = make_agent(policy, tmp_path, failure_limit=1).run(
            Goal(name="x", objective="y", max_steps=1)
        )
        assert "unknown tool" in (result.steps[0].observation.error or "")

    def test_bad_arguments_are_a_failed_step(self, tmp_path):
        policy = LoopingPolicy(Action(tool="echo", args={"wrong": 1}))
        result = make_agent(policy, tmp_path, failure_limit=1).run(
            Goal(name="x", objective="y", max_steps=1)
        )
        assert "unknown argument" in (result.steps[0].observation.error or "")

    def test_failed_finish_does_not_complete_the_run(self, tmp_path):
        # finish requires a summary; without it the run must not report success.
        policy = LoopingPolicy(Action(tool="finish", args={}))
        result = make_agent(policy, tmp_path, failure_limit=2).run(
            Goal(name="x", objective="y", max_steps=5)
        )
        assert result.status == "failed"
        assert not result.ok


class TestPlaybookFailure:
    """A fixed plan cannot adapt, so the first failed step must stop the run."""

    def test_failed_step_aborts_the_playbook(self, tmp_path):
        goal = Goal(
            name="demo",
            objective="fail early",
            playbook=[
                {"tool": "always_fails", "args": {}},
                {"tool": "echo", "args": {"text": "should never run"}},
                {"tool": "finish", "args": {"summary": "should never run"}},
            ],
        )
        result = make_agent(RulePolicy(), tmp_path).run(goal)

        assert result.status == "failed"
        assert not result.ok
        # Only the failing step ran; the dependent steps were not attempted.
        assert len(result.steps) == 1
        assert "playbook aborted at step 0" in result.summary
        # A deliberate abort reads as itself, not as an internal policy crash.
        assert not result.summary.startswith("Policy error:")

    def test_stop_on_failure_can_be_disabled(self, tmp_path):
        goal = Goal(
            name="demo",
            objective="carry on",
            playbook=[
                {"tool": "always_fails", "args": {}},
                {"tool": "finish", "args": {"summary": "carried on"}},
            ],
        )
        result = make_agent(RulePolicy(stop_on_failure=False), tmp_path).run(goal)

        assert result.status == "completed"
        assert result.failures == 1
        assert result.summary == "carried on"


class TestJournal:
    def test_writes_every_step_as_it_happens(self, tmp_path):
        journal = Journal(tmp_path / "runs", "run-1")
        goal = Goal(
            name="demo",
            objective="journal",
            playbook=[
                {"tool": "echo", "args": {"text": "hi"}},
                {"tool": "finish", "args": {"summary": "done"}},
            ],
        )
        make_agent(RulePolicy(), tmp_path, journal=journal).run(goal)

        records = list(journal.read())
        kinds = [r["kind"] for r in records]
        assert kinds == ["run_started", "step", "step", "run_finished"]
        assert records[-1]["status"] == "completed"
        assert records[1]["action"]["tool"] == "echo"

    def test_survives_a_malformed_line(self, tmp_path):
        journal = Journal(tmp_path, "run-2")
        journal.path.write_text('{"kind": "step"}\nnot json\n{"kind": "run_finished"}\n')
        assert [r["kind"] for r in journal.read()] == ["step", "run_finished"]

    def test_result_serialises_to_json(self, tmp_path):
        goal = Goal(
            name="demo",
            objective="serialise",
            playbook=[{"tool": "finish", "args": {"summary": "ok"}}],
        )
        result = make_agent(RulePolicy(), tmp_path).run(goal)
        payload = json.loads(json.dumps(result.to_dict(), default=str))
        assert payload["status"] == "completed"
        assert payload["step_count"] == 1


class TestObservation:
    def test_policy_sees_every_step(self, tmp_path):
        policy = LoopingPolicy(Action(tool="echo", args={"text": "x"}))
        make_agent(policy, tmp_path).run(Goal(name="x", objective="y", max_steps=3))
        assert len(policy.observed) == 3
        assert all(s.observation.ok for s in policy.observed)

    def test_observe_exception_does_not_stop_the_run(self, tmp_path):
        class BadObserver(BasePolicy):
            def propose(self, goal, steps, registry):
                if steps:
                    return Action(tool="finish", args={"summary": "done"})
                return Action(tool="echo", args={"text": "x"})

            def observe(self, step):
                raise RuntimeError("observer exploded")

        result = make_agent(BadObserver(), tmp_path).run(Goal(name="x", objective="y"))
        assert result.status == "completed"
