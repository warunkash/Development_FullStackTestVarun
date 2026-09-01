"""Core data types shared by the agent loop, policies and tools.

The loop is deliberately built out of small frozen records: every decision the
bot makes (:class:`Action`) and everything the world says back
(:class:`Observation`) is a value that can be logged, replayed and asserted on
in tests.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal


def utcnow() -> str:
    """Current UTC time as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass(frozen=True)
class Action:
    """A single tool invocation the policy wants to perform."""

    tool: str
    args: dict[str, Any] = field(default_factory=dict)
    rationale: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"tool": self.tool, "args": self.args, "rationale": self.rationale}


@dataclass(frozen=True)
class Observation:
    """The result of executing an :class:`Action`."""

    ok: bool
    output: str
    error: str | None = None
    elapsed_s: float = 0.0

    @classmethod
    def failure(cls, error: str, elapsed_s: float = 0.0) -> "Observation":
        return cls(ok=False, output="", error=error, elapsed_s=elapsed_s)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "output": self.output,
            "error": self.error,
            "elapsed_s": round(self.elapsed_s, 4),
        }


@dataclass(frozen=True)
class Step:
    """One full plan -> act -> observe cycle."""

    index: int
    action: Action
    observation: Observation
    at: str = field(default_factory=utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "index": self.index,
            "at": self.at,
            "action": self.action.to_dict(),
            "observation": self.observation.to_dict(),
        }


@dataclass
class Goal:
    """What the bot is being asked to achieve on one run."""

    name: str
    objective: str
    context: dict[str, Any] = field(default_factory=dict)
    max_steps: int = 12
    deadline_s: float = 300.0
    # Optional deterministic plan consumed by RulePolicy.
    playbook: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "objective": self.objective,
            "context": self.context,
            "max_steps": self.max_steps,
            "deadline_s": self.deadline_s,
        }


RunStatus = Literal["completed", "max_steps", "deadline", "failed", "aborted"]


@dataclass
class RunResult:
    """Everything that happened during one agent run."""

    goal: Goal
    status: RunStatus
    steps: list[Step] = field(default_factory=list)
    summary: str = ""
    started_at: str = field(default_factory=utcnow)
    finished_at: str = field(default_factory=utcnow)

    @property
    def ok(self) -> bool:
        return self.status == "completed"

    @property
    def failures(self) -> int:
        return sum(1 for s in self.steps if not s.observation.ok)

    def to_dict(self) -> dict[str, Any]:
        return {
            "goal": self.goal.to_dict(),
            "status": self.status,
            "summary": self.summary,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "step_count": len(self.steps),
            "failures": self.failures,
            "steps": [s.to_dict() for s in self.steps],
        }


class Budget:
    """Tracks the two hard stops on an autonomous run: steps and wall clock."""

    def __init__(self, max_steps: int, deadline_s: float) -> None:
        self.max_steps = max_steps
        self.deadline_s = deadline_s
        self._start = time.monotonic()
        self.steps_used = 0

    @property
    def elapsed_s(self) -> float:
        return time.monotonic() - self._start

    @property
    def remaining_s(self) -> float:
        return max(0.0, self.deadline_s - self.elapsed_s)

    def exhausted(self) -> RunStatus | None:
        """Return the stop reason if the budget is spent, else ``None``."""
        if self.steps_used >= self.max_steps:
            return "max_steps"
        if self.elapsed_s >= self.deadline_s:
            return "deadline"
        return None
