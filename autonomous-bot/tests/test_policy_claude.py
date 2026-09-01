"""Tests for the Claude-backed policy.

These use a fake client, so they run without the Anthropic SDK, credentials or
network. What they pin down is the request shape and how the policy reacts to
each kind of response - the parts that are easy to get subtly wrong.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from autobot.agent import Agent
from autobot.builtins import default_registry
from autobot.models import Action, Goal, Observation, Step
from autobot.policy import DEFAULT_MODEL, ClaudePolicy, build_policy, translate_api_error


def text_block(text: str) -> SimpleNamespace:
    return SimpleNamespace(type="text", text=text)


def tool_use_block(tool_id: str, name: str, payload: dict) -> SimpleNamespace:
    return SimpleNamespace(type="tool_use", id=tool_id, name=name, input=payload)


def response(content: list, stop_reason: str = "tool_use", **extra) -> SimpleNamespace:
    return SimpleNamespace(content=content, stop_reason=stop_reason, **extra)


class FakeMessages:
    """Records every request and replays a scripted list of responses."""

    def __init__(self, script: list) -> None:
        self.script = list(script)
        self.requests: list[dict] = []

    def create(self, **kwargs):
        self.requests.append(kwargs)
        if not self.script:
            raise AssertionError("the policy made more requests than the script allows")
        nxt = self.script.pop(0)
        if isinstance(nxt, Exception):
            raise nxt
        return nxt


class FakeClient:
    def __init__(self, script: list) -> None:
        self.messages = FakeMessages(script)
        self.beta = SimpleNamespace(messages=self.messages)


def make_policy(script: list) -> ClaudePolicy:
    return ClaudePolicy(client=FakeClient(script))


GOAL = Goal(name="t", objective="do the thing", max_steps=5, deadline_s=60)


class TestRequestShape:
    def test_sends_the_expected_parameters(self):
        policy = make_policy([response([tool_use_block("t1", "current_time", {})])])
        registry = default_registry()
        policy.reset(GOAL, registry)
        policy.propose(GOAL, [], registry)

        request = policy._client.messages.requests[0]
        assert request["model"] == DEFAULT_MODEL == "claude-opus-5"
        # Adaptive thinking, effort in output_config, no deprecated budget_tokens.
        assert request["thinking"] == {"type": "adaptive"}
        assert request["output_config"] == {"effort": "high"}
        assert "budget_tokens" not in str(request["thinking"])
        # Refusal fallbacks are opted into, with the matching beta flag.
        assert request["fallbacks"] == "default"
        assert request["betas"] == ["server-side-fallback-2026-07-01"]

    def test_sends_every_tool_schema_in_a_stable_order(self):
        policy = make_policy([response([tool_use_block("t1", "finish", {"summary": "x"})])])
        registry = default_registry()
        policy.reset(GOAL, registry)
        policy.propose(GOAL, [], registry)

        sent = policy._client.messages.requests[0]["tools"]
        names = [t["name"] for t in sent]
        assert names == sorted(names)
        assert names == registry.names()
        assert all(set(t) == {"name", "description", "input_schema"} for t in sent)

    def test_system_prompt_is_cacheable_and_goal_goes_in_the_user_turn(self):
        policy = make_policy([response([tool_use_block("t1", "current_time", {})])])
        registry = default_registry()
        policy.reset(GOAL, registry)
        policy.propose(GOAL, [], registry)

        request = policy._client.messages.requests[0]
        system = request["system"][0]
        assert system["cache_control"] == {"type": "ephemeral"}
        # The volatile part (the objective) must not sit in the cached prefix.
        assert "do the thing" not in system["text"]
        assert "do the thing" in request["messages"][0]["content"]

    def test_opening_message_includes_context_and_budget(self):
        goal = Goal(
            name="t",
            objective="obj",
            context={"repo": "example"},
            max_steps=7,
            deadline_s=90,
        )
        policy = make_policy([response([tool_use_block("t1", "current_time", {})])])
        policy.reset(goal, default_registry())
        opening = policy._messages[0]["content"]
        assert "repo: example" in opening
        assert "7 steps" in opening
        assert "90 seconds" in opening


class TestActionSelection:
    def test_returns_the_tool_call(self):
        policy = make_policy(
            [response([tool_use_block("t1", "write_file", {"path": "a.txt", "content": "hi"})])]
        )
        registry = default_registry()
        policy.reset(GOAL, registry)
        action = policy.propose(GOAL, [], registry)

        assert action.tool == "write_file"
        assert action.args == {"path": "a.txt", "content": "hi"}

    def test_carries_leading_text_as_the_rationale(self):
        policy = make_policy(
            [response([text_block("Checking the time first."), tool_use_block("t1", "current_time", {})])]
        )
        registry = default_registry()
        policy.reset(GOAL, registry)
        assert "Checking the time first." in policy.propose(GOAL, [], registry).rationale

    def test_end_turn_without_a_tool_call_finishes(self):
        policy = make_policy([response([text_block("All done.")], stop_reason="end_turn")])
        registry = default_registry()
        policy.reset(GOAL, registry)
        action = policy.propose(GOAL, [], registry)

        assert action.tool == "finish"
        assert action.args["summary"] == "All done."

    def test_refusal_stops_the_run_without_reading_content(self):
        # A policy decline arrives as HTTP 200 with stop_reason "refusal".
        policy = make_policy(
            [
                response(
                    [],
                    stop_reason="refusal",
                    stop_details=SimpleNamespace(type="refusal", explanation="declined"),
                )
            ]
        )
        registry = default_registry()
        policy.reset(GOAL, registry)
        action = policy.propose(GOAL, [], registry)

        assert action.tool == "finish"
        assert "declined" in action.args["summary"]

    def test_parallel_tool_calls_keep_the_first(self):
        policy = make_policy(
            [
                response(
                    [
                        tool_use_block("t1", "current_time", {}),
                        tool_use_block("t2", "list_dir", {"path": "."}),
                    ]
                )
            ]
        )
        registry = default_registry()
        policy.reset(GOAL, registry)
        action = policy.propose(GOAL, [], registry)

        assert action.tool == "current_time"
        assert policy._skipped == ["t2"]


class TestConversationMirroring:
    def _advance(self, policy, registry, ok=True):
        action = policy.propose(GOAL, [], registry)
        step = Step(
            index=0,
            action=action,
            observation=Observation(ok=ok, output="result text")
            if ok
            else Observation.failure("it broke"),
        )
        policy.observe(step)
        return step

    def test_tool_result_is_fed_back_with_the_matching_id(self):
        policy = make_policy([response([tool_use_block("t1", "current_time", {})])])
        registry = default_registry()
        policy.reset(GOAL, registry)
        self._advance(policy, registry)

        assert policy._messages[-2]["role"] == "assistant"
        result_turn = policy._messages[-1]
        assert result_turn["role"] == "user"
        block = result_turn["content"][0]
        assert block["tool_use_id"] == "t1"
        assert block["content"] == "result text"
        assert block["is_error"] is False

    def test_failed_step_is_reported_as_an_error_result(self):
        policy = make_policy([response([tool_use_block("t1", "read_file", {"path": "x"})])])
        registry = default_registry()
        policy.reset(GOAL, registry)
        self._advance(policy, registry, ok=False)

        block = policy._messages[-1]["content"][0]
        assert block["is_error"] is True
        assert block["content"] == "it broke"

    def test_skipped_parallel_calls_still_get_a_result(self):
        # Every tool_use block needs a matching tool_result or the next request
        # is rejected by the API.
        policy = make_policy(
            [
                response(
                    [
                        tool_use_block("t1", "current_time", {}),
                        tool_use_block("t2", "current_time", {}),
                    ]
                )
            ]
        )
        registry = default_registry()
        policy.reset(GOAL, registry)
        self._advance(policy, registry)

        ids = [b["tool_use_id"] for b in policy._messages[-1]["content"]]
        assert ids == ["t1", "t2"]
        assert policy._skipped == []

    def test_reset_clears_state_between_runs(self):
        policy = make_policy(
            [
                response([tool_use_block("t1", "current_time", {})]),
                response([tool_use_block("t2", "current_time", {})]),
            ]
        )
        registry = default_registry()
        policy.reset(GOAL, registry)
        self._advance(policy, registry)
        policy.reset(GOAL, registry)

        assert len(policy._messages) == 1
        assert policy._tool_use_id is None
        assert policy._skipped == []


class TestEndToEnd:
    def test_drives_a_full_agent_run(self, tmp_path):
        policy = make_policy(
            [
                response([tool_use_block("t1", "write_file", {"path": "out.txt", "content": "hi"})]),
                response([tool_use_block("t2", "read_file", {"path": "out.txt"})]),
                response([tool_use_block("t3", "finish", {"summary": "wrote and verified"})]),
            ]
        )
        agent = Agent(policy=policy, registry=default_registry(), workspace=str(tmp_path))
        result = agent.run(Goal(name="e2e", objective="write a file", max_steps=6))

        assert result.status == "completed"
        assert result.summary == "wrote and verified"
        assert (tmp_path / "out.txt").read_text() == "hi"
        assert [s.action.tool for s in result.steps] == ["write_file", "read_file", "finish"]

    def test_model_can_recover_from_a_failed_tool_call(self, tmp_path):
        policy = make_policy(
            [
                response([tool_use_block("t1", "read_file", {"path": "missing.txt"})]),
                response([tool_use_block("t2", "write_file", {"path": "made.txt", "content": "x"})]),
                response([tool_use_block("t3", "finish", {"summary": "recovered"})]),
            ]
        )
        agent = Agent(policy=policy, registry=default_registry(), workspace=str(tmp_path))
        result = agent.run(Goal(name="e2e", objective="recover", max_steps=6))

        assert result.status == "completed"
        assert result.failures == 1
        # The failure was reported back to the model as an error result.
        assert policy._client.messages.requests[1]["messages"][-1]["content"][0]["is_error"] is True


class TestErrorTranslation:
    def test_passes_through_when_sdk_is_absent(self):
        # Without the SDK installed there are no typed errors to match on.
        original = ValueError("boom")
        assert translate_api_error(original, "claude-opus-5") is original

    def test_request_failure_surfaces_to_the_agent_as_a_failed_run(self, tmp_path):
        policy = make_policy([RuntimeError("connection reset")])
        agent = Agent(policy=policy, registry=default_registry(), workspace=str(tmp_path))
        result = agent.run(Goal(name="e2e", objective="fail", max_steps=3))

        assert result.status == "failed"
        assert "connection reset" in result.summary


class TestFactory:
    def test_builds_claude_policy_with_settings(self):
        policy = build_policy("claude", model="claude-opus-5", effort="low", max_tokens=1234)
        assert isinstance(policy, ClaudePolicy)
        assert policy.effort == "low"
        assert policy.max_tokens == 1234

    def test_rejects_unknown_policy(self):
        with pytest.raises(ValueError, match="unknown policy"):
            build_policy("magic")

    def test_claude_policy_without_sdk_explains_itself(self):
        with pytest.raises(RuntimeError, match="pip install anthropic"):
            _ = ClaudePolicy().client
