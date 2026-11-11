"""The kernel — the loop every agent runs on.

The order of checks in `step()` is the whole design, so it is worth stating:

1. kill switch      — cheapest, and the one you want honoured first
2. step/time ceiling — before we bother the planner
3. planner          — decides the next action
3b. kill switch     — again: planning is slow, and a stop during it counts
4. registry         — the tool must exist
5. policy           — the tool must be permitted, with *these* arguments
6. schema           — the arguments must typecheck
7. cost ceiling     — knowable only once we know which tool
8. execute

A tool body is never entered until all seven have passed. Everything above it
is recorded in the trace whether it passes or not, so a denied call is as
visible as a successful one.

An agent is a `Planner` plus a config object. The OS does not change per agent.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Protocol

from .budget import Budget
from .errors import BudgetExceeded, HaltReason, Killed, PermissionDenied, ToolError
from .killswitch import KillSwitch
from .memory import Memory
from .permissions import Policy
from .registry import Registry
from .tracing import Trace


@dataclass(frozen=True)
class Action:
    """What the planner wants to do next."""

    tool: str | None = None
    args: dict[str, Any] = field(default_factory=dict)
    finish: bool = False
    answer: Any = None

    @classmethod
    def call(cls, tool: str, **args: Any) -> "Action":
        return cls(tool=tool, args=args)

    @classmethod
    def done(cls, answer: Any = None) -> "Action":
        return cls(finish=True, answer=answer)


@dataclass
class Observation:
    """The result of one step, fed back to the planner on the next."""

    tool: str
    args: dict[str, Any]
    ok: bool
    result: Any = None
    error: str | None = None


@dataclass
class State:
    """Everything the planner is allowed to see."""

    goal: str
    observations: list[Observation] = field(default_factory=list)
    memory: Memory | None = None
    steps_remaining: int = 0

    @property
    def last(self) -> Observation | None:
        return self.observations[-1] if self.observations else None


class Planner(Protocol):
    """Anything that turns state into a next action.

    A rules engine, a search, or a model call — the kernel does not care and
    deliberately does not import one.
    """

    def __call__(self, state: State) -> Action: ...


@dataclass
class RunResult:
    run_id: str
    ok: bool
    answer: Any = None
    halted_by: str | None = None
    detail: str | None = None
    steps: int = 0
    trace: Trace | None = None
    budget: dict[str, Any] = field(default_factory=dict)

    def __bool__(self) -> bool:
        return self.ok


@dataclass
class AgentSpec:
    """An agent, as configuration.

    Build the OS once; this is the part that varies. Two agents differing only
    in policy and budget are two of these, not two codebases.
    """

    name: str
    policy: Policy
    budget: Budget = field(default_factory=Budget)
    memory_namespace: str | None = None
    trace_dir: str | Path | None = None
    kill_file: str | Path | None = None


class Kernel:
    """Runs one agent at a time, under one spec."""

    def __init__(
        self,
        registry: Registry,
        spec: AgentSpec,
        memory: Memory | None = None,
        kill_switch: KillSwitch | None = None,
    ):
        self.registry = registry
        self.spec = spec
        self.memory = memory or Memory(":memory:", spec.memory_namespace or spec.name)
        self.kill = kill_switch or KillSwitch(spec.kill_file)

    # -- one step -------------------------------------------------------------

    def _execute(self, action: Action, trace: Trace, budget: Budget) -> Observation:
        """Resolve, authorise and run a single tool call.

        Raises `HaltReason` subclasses for conditions that should stop the run;
        returns a failed Observation for errors the agent could recover from.
        """
        assert action.tool is not None
        tool = self.registry.get(action.tool)  # UnknownToolError if absent
        self.spec.policy.check(action.tool, action.args)  # PermissionDenied
        tool.validate(action.args)  # ToolValidationError
        budget.check(next_cost=tool.cost)  # BudgetExceeded

        started = time.monotonic()
        try:
            result = tool.fn(**action.args)
        except Exception as e:
            # A tool blowing up is data, not a crash: the agent gets to see the
            # error and try something else. Only OS-level conditions halt a run.
            budget.charge(steps=1, cost=tool.cost)
            trace.emit(
                "tool_error",
                tool=action.tool,
                args=action.args,
                error=f"{type(e).__name__}: {e}",
                seconds=round(time.monotonic() - started, 4),
            )
            return Observation(action.tool, action.args, ok=False, error=f"{type(e).__name__}: {e}")

        budget.charge(steps=1, cost=tool.cost)
        trace.emit(
            "tool_result",
            tool=action.tool,
            args=action.args,
            result=result,
            cost=tool.cost,
            seconds=round(time.monotonic() - started, 4),
        )
        return Observation(action.tool, action.args, ok=True, result=result)

    # -- the loop -------------------------------------------------------------

    def run(self, goal: str, planner: Planner) -> RunResult:
        budget = self.spec.budget
        budget.start()

        trace_path = None
        if self.spec.trace_dir is not None:
            trace_path = Path(self.spec.trace_dir).expanduser()
        trace = Trace()
        if trace_path is not None:
            trace = Trace(run_id=trace.run_id, path=trace_path / f"{trace.run_id}.jsonl")

        trace.emit("run_start", agent=self.spec.name, goal=goal, tools=self.registry.names())
        self.memory.record("goal", goal, run_id=trace.run_id)

        state = State(goal=goal, memory=self.memory, steps_remaining=budget.remaining_steps())
        answer: Any = None
        halted_by: str | None = None
        detail: str | None = None

        try:
            while True:
                self.kill.check()
                budget.check()

                action = planner(state)
                trace.emit(
                    "step",
                    n=budget.steps_used + 1,
                    tool=action.tool,
                    args=action.args,
                    finish=action.finish,
                )

                if action.finish:
                    answer = action.answer
                    break
                if action.tool is None:
                    raise ToolError("planner returned an action with no tool and finish=False")

                # Re-check: planning is the slow part (an LLM round-trip), and a
                # switch tripped during it must not be honoured one step late.
                self.kill.check()

                observation = self._execute(action, trace, budget)
                state.observations.append(observation)
                state.steps_remaining = budget.remaining_steps()
                self.memory.record(
                    "observation",
                    f"{observation.tool} -> {'ok' if observation.ok else observation.error}",
                    run_id=trace.run_id,
                )

        except Killed as e:
            halted_by, detail = "killed", str(e)
        except BudgetExceeded as e:
            halted_by, detail = "budget_exceeded", str(e)
        except PermissionDenied as e:
            halted_by, detail = "permission_denied", str(e)
        except ToolError as e:
            halted_by, detail = "tool_error", str(e)
        except HaltReason as e:  # pragma: no cover - future halt types
            halted_by, detail = type(e).__name__.lower(), str(e)

        if halted_by is not None:
            trace.emit("halt", reason=halted_by, detail=detail)

        trace.emit(
            "run_end",
            ok=halted_by is None,
            answer=answer,
            steps=budget.steps_used,
            budget=budget.snapshot(),
        )
        trace.close()

        return RunResult(
            run_id=trace.run_id,
            ok=halted_by is None,
            answer=answer,
            halted_by=halted_by,
            detail=detail,
            steps=budget.steps_used,
            trace=trace,
            budget=budget.snapshot(),
        )
