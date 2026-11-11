"""Policies - the pluggable "brain" that decides the next action.

A policy sees the goal and everything observed so far, and returns the next
:class:`Action`. Two are shipped:

* :class:`RulePolicy` replays a declarative playbook. It needs no credentials
  and no network, which makes the bot runnable in CI and testable end to end.
* :class:`ClaudePolicy` asks Claude to choose the next tool call, so the run is
  genuinely open-ended.

Anything with a ``propose`` method works, so a project can drop in its own.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any, Protocol, runtime_checkable

from .builtins import FINISH_TOOL
from .models import Action, Goal, Step
from .tools import ToolRegistry

logger = logging.getLogger("autobot.policy")

DEFAULT_MODEL = "claude-opus-5"

SYSTEM_PROMPT = """You are an autonomous agent running without a human watching.

You are given an objective and a set of tools. Work towards the objective one
tool call at a time. After each call you will see its result and choose the next
step.

Rules:
- Make exactly one tool call per turn.
- Prefer gathering information before making changes.
- If a tool fails, read the error and adapt; do not retry the identical call.
- Call the `finish` tool as soon as the objective is met, or when you have
  established that it cannot be met - say plainly which of the two happened.
- You have a limited step budget. Spend it on the objective, not on exploration
  that cannot change what you do next.
"""


@runtime_checkable
class Policy(Protocol):
    """The interface the agent loop depends on."""

    def reset(self, goal: Goal, registry: ToolRegistry) -> None:
        """Prepare for a new run."""

    def propose(self, goal: Goal, steps: list[Step], registry: ToolRegistry) -> Action:
        """Choose the next action given everything observed so far."""

    def observe(self, step: Step) -> None:
        """Record the outcome of the action just taken."""


class BasePolicy:
    """Default no-op implementations of the optional hooks."""

    def reset(self, goal: Goal, registry: ToolRegistry) -> None:  # noqa: D102
        return None

    def observe(self, step: Step) -> None:  # noqa: D102
        return None


_TEMPLATE = re.compile(r"\{\{\s*([^}]+?)\s*\}\}")


class PlaybookAborted(RuntimeError):
    """Raised when a deterministic playbook hits a step it cannot recover from."""


class RulePolicy(BasePolicy):
    """Replays a fixed playbook of tool calls, then finishes.

    Each playbook entry is ``{"tool": ..., "args": {...}, "rationale": ...}``.
    String arguments may reference earlier results with ``{{last_output}}``,
    ``{{steps[N].output}}``, ``{{context.key}}`` or ``{{env.NAME}}``.

    A fixed plan has no way to recover from a failed step - and later steps
    usually depend on earlier ones - so by default the first failure aborts the
    run instead of marching on and reporting success. Pass
    ``stop_on_failure=False`` for a playbook whose steps are independent.
    """

    def __init__(
        self,
        playbook: list[dict[str, Any]] | None = None,
        stop_on_failure: bool = True,
    ) -> None:
        self.playbook = list(playbook or [])
        self.stop_on_failure = stop_on_failure
        self._goal: Goal | None = None

    def reset(self, goal: Goal, registry: ToolRegistry) -> None:
        self._goal = goal
        if not self.playbook and goal.playbook:
            self.playbook = list(goal.playbook)

    def propose(self, goal: Goal, steps: list[Step], registry: ToolRegistry) -> Action:
        index = len(steps)
        if self.stop_on_failure and steps and not steps[-1].observation.ok:
            previous = steps[-1]
            raise PlaybookAborted(
                f"playbook aborted at step {previous.index} "
                f"({previous.action.tool}): {previous.observation.error}"
            )
        if index >= len(self.playbook):
            return Action(
                tool=FINISH_TOOL,
                args={"summary": f"Playbook complete: ran {index} step(s)."},
                rationale="no playbook entries remain",
            )
        entry = self.playbook[index]
        name = entry.get("tool")
        if not name:
            raise ValueError(f"playbook entry {index} has no 'tool' key")
        args = self._render(entry.get("args", {}) or {}, goal, steps)
        return Action(tool=name, args=args, rationale=entry.get("rationale", ""))

    def _render(self, value: Any, goal: Goal, steps: list[Step]) -> Any:
        """Substitute ``{{...}}`` references inside strings, recursively."""
        if isinstance(value, dict):
            return {k: self._render(v, goal, steps) for k, v in value.items()}
        if isinstance(value, list):
            return [self._render(v, goal, steps) for v in value]
        if not isinstance(value, str):
            return value
        return _TEMPLATE.sub(lambda m: self._lookup(m.group(1), goal, steps), value)

    def _lookup(self, expression: str, goal: Goal, steps: list[Step]) -> str:
        if expression == "last_output":
            return steps[-1].observation.output if steps else ""
        match = re.fullmatch(r"steps\[(-?\d+)\]\.(output|error)", expression)
        if match:
            position = int(match.group(1))
            try:
                observation = steps[position].observation
            except IndexError:
                return ""
            return (observation.output if match.group(2) == "output" else observation.error) or ""
        if expression.startswith("context."):
            return str(goal.context.get(expression[len("context.") :], ""))
        if expression.startswith("env."):
            return os.environ.get(expression[len("env.") :], "")
        logger.warning("unrecognised template expression: %s", expression)
        return ""


def translate_api_error(exc: Exception, model: str) -> Exception:
    """Map the SDK's typed errors onto actionable messages, most specific first.

    Catching one broad class would lose the distinction between retryable
    failures (rate limits, connection errors) and permanent ones (a model the
    account cannot use), so each is named. Errors are returned rather than
    raised so the caller keeps the original as ``__cause__``.
    """
    try:
        import anthropic
    except ImportError:
        return exc

    # NotFoundError and RateLimitError both subclass APIStatusError - order matters.
    if isinstance(exc, anthropic.NotFoundError):
        return RuntimeError(f"model '{model}' is not available to this account: {exc}")
    if isinstance(exc, anthropic.RateLimitError):
        return RuntimeError(f"rate limited by the Claude API: {exc}")
    if isinstance(exc, anthropic.APIStatusError):
        return RuntimeError(f"Claude API error {exc.status_code}: {exc}")
    if isinstance(exc, anthropic.APIConnectionError):
        return RuntimeError(f"could not reach the Claude API: {exc}")
    return exc


class ClaudePolicy(BasePolicy):
    """Asks Claude which tool to call next, one step at a time.

    The agent loop owns iteration and budgets, so this policy makes a single
    Messages API request per step and mirrors the conversation itself: the
    assistant turn goes in on ``propose`` and the matching ``tool_result`` on
    ``observe``.
    """

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        max_tokens: int = 16000,
        effort: str = "high",
        client: Any = None,
    ) -> None:
        self.model = model
        self.max_tokens = max_tokens
        self.effort = effort
        self._client = client
        self._messages: list[dict[str, Any]] = []
        self._tool_use_id: str | None = None
        self._skipped: list[str] = []
        self._registry: ToolRegistry | None = None

    @property
    def client(self) -> Any:
        """The Anthropic client, imported and constructed on first use."""
        if self._client is None:
            try:
                import anthropic
            except ImportError as exc:  # pragma: no cover - depends on env
                raise RuntimeError(
                    "the Claude policy needs the Anthropic SDK: pip install anthropic"
                ) from exc
            # Zero-arg construction resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN
            # or an `ant auth login` profile - do not hardcode a key.
            self._client = anthropic.Anthropic()
        return self._client

    def reset(self, goal: Goal, registry: ToolRegistry) -> None:
        self._registry = registry
        self._tool_use_id = None
        self._skipped = []
        self._messages = [{"role": "user", "content": self._opening_message(goal)}]

    @staticmethod
    def _opening_message(goal: Goal) -> str:
        lines = [f"Objective: {goal.objective}"]
        if goal.context:
            lines.append("\nContext:")
            lines.extend(f"- {k}: {v}" for k, v in goal.context.items())
        lines.append(
            f"\nYou have at most {goal.max_steps} steps and "
            f"{int(goal.deadline_s)} seconds. Begin."
        )
        return "\n".join(lines)

    def propose(self, goal: Goal, steps: list[Step], registry: ToolRegistry) -> Action:
        if not self._messages:
            self.reset(goal, registry)

        response = self._request(registry)

        # A policy decline arrives as HTTP 200 - check before reading content.
        if response.stop_reason == "refusal":
            details = getattr(response, "stop_details", None)
            reason = getattr(details, "explanation", None) or "no explanation given"
            return Action(
                tool=FINISH_TOOL,
                args={"summary": f"Stopping: the model declined this request ({reason})."},
                rationale="refusal",
            )

        self._messages.append({"role": "assistant", "content": response.content})

        tool_uses = [b for b in response.content if b.type == "tool_use"]
        if not tool_uses:
            text = " ".join(b.text for b in response.content if b.type == "text").strip()
            return Action(
                tool=FINISH_TOOL,
                args={"summary": text or "The model ended the turn without a tool call."},
                rationale="model stopped calling tools",
            )

        # One action per step: keep the first call and tell the model the rest
        # were not run, so the transcript stays truthful.
        chosen = tool_uses[0]
        self._tool_use_id = chosen.id
        self._skipped = [b.id for b in tool_uses[1:]]
        thinking = " ".join(b.text for b in response.content if b.type == "text").strip()
        return Action(tool=chosen.name, args=dict(chosen.input), rationale=thinking[:500])

    def _request(self, registry: ToolRegistry) -> Any:
        """One Messages API call, with the SDK's typed errors surfaced usefully."""
        try:
            return self.client.beta.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                # Stable prefix: frozen system text, then the sorted tool list.
                system=[
                    {
                        "type": "text",
                        "text": SYSTEM_PROMPT,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                thinking={"type": "adaptive"},
                output_config={"effort": self.effort},
                tools=registry.api_schemas(),
                # Snapshot: the policy keeps appending to _messages, and the
                # request should reflect the conversation as it stands now.
                messages=list(self._messages),
                # Route around a policy decline instead of dead-ending the run.
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            )
        except Exception as exc:
            raise translate_api_error(exc, self.model) from exc

    def observe(self, step: Step) -> None:
        """Feed the tool result back as the next user turn."""
        if self._tool_use_id is None:
            return
        observation = step.observation
        content: list[dict[str, Any]] = [
            {
                "type": "tool_result",
                "tool_use_id": self._tool_use_id,
                "content": observation.output if observation.ok else (observation.error or "failed"),
                "is_error": not observation.ok,
            }
        ]
        # Every tool_use block needs a result, including the ones we declined to run.
        for skipped in self._skipped:
            content.append(
                {
                    "type": "tool_result",
                    "tool_use_id": skipped,
                    "content": "Not run: this agent executes one tool call per step.",
                    "is_error": True,
                }
            )
        self._messages.append({"role": "user", "content": content})
        self._tool_use_id = None
        self._skipped = []


def build_policy(name: str, goal: Goal | None = None, **kwargs: Any) -> Policy:
    """Construct a policy by name (``"rule"`` or ``"claude"``)."""
    key = name.strip().lower()
    if key in {"rule", "rules", "playbook", "deterministic"}:
        return RulePolicy(playbook=goal.playbook if goal else None, **kwargs)
    if key in {"claude", "llm", "anthropic"}:
        return ClaudePolicy(**kwargs)
    raise ValueError(f"unknown policy '{name}'; expected 'rule' or 'claude'")
