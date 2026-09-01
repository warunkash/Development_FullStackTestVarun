"""The agent loop: plan -> act -> observe, under a budget.

The loop owns iteration and safety; the policy only chooses actions and the
tools only do work. That separation is what lets the same agent run against a
deterministic playbook in CI and against Claude in production.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Callable

from .builtins import FINISH_TOOL
from .memory import Journal
from .models import Action, Budget, Goal, Observation, RunResult, RunStatus, Step, utcnow
from .policy import PlaybookAborted
from .tools import ToolContext, ToolError, ToolRegistry

logger = logging.getLogger("autobot.agent")

#: Consecutive failed steps after which the run is abandoned. A policy that
#: cannot recover from three failures in a row is looping, not working.
DEFAULT_FAILURE_LIMIT = 3


class Agent:
    """Drives one goal to completion (or to its budget)."""

    def __init__(
        self,
        policy: Any,
        registry: ToolRegistry,
        workspace: str = ".",
        journal: Journal | None = None,
        config: Any = None,
        failure_limit: int = DEFAULT_FAILURE_LIMIT,
        on_step: Callable[[Step], None] | None = None,
    ) -> None:
        self.policy = policy
        self.registry = registry
        self.workspace = workspace
        self.journal = journal
        self.config = config
        self.failure_limit = failure_limit
        self.on_step = on_step

    def run(self, goal: Goal) -> RunResult:
        """Work the goal until it finishes, the budget runs out, or it gives up."""
        started_at = utcnow()
        budget = Budget(goal.max_steps, goal.deadline_s)
        ctx = ToolContext(workspace=self.workspace, config=self.config)
        steps: list[Step] = []
        consecutive_failures = 0
        status: RunStatus = "max_steps"
        summary = ""

        self.policy.reset(goal, self.registry)
        if self.journal:
            self.journal.run_started(goal.to_dict(), type(self.policy).__name__)
        logger.info("run started: %s (max %d steps)", goal.name, goal.max_steps)

        while True:
            spent = budget.exhausted()
            if spent is not None:
                status = spent
                summary = (
                    f"Stopped after {len(steps)} step(s): "
                    f"{'step budget' if spent == 'max_steps' else 'time budget'} exhausted."
                )
                break

            # --- plan ---
            try:
                action = self.policy.propose(goal, steps, self.registry)
            except PlaybookAborted as exc:
                # A deliberate stop, not a crash - no traceback wanted.
                logger.warning("%s", exc)
                status = "failed"
                summary = str(exc)
                break
            except Exception as exc:
                logger.exception("policy failed to propose an action")
                status = "failed"
                summary = f"Policy error: {exc}"
                break

            # --- act ---
            observation = self._execute(action, ctx)
            budget.steps_used += 1
            step = Step(index=len(steps), action=action, observation=observation)
            steps.append(step)

            # --- observe ---
            try:
                self.policy.observe(step)
            except Exception:
                logger.exception("policy.observe raised; continuing")
            if self.journal:
                self.journal.step(step)
            if self.on_step:
                self.on_step(step)

            logger.info(
                "step %d: %s -> %s%s",
                step.index,
                action.tool,
                "ok" if observation.ok else "FAILED",
                "" if observation.ok else f" ({observation.error})",
            )

            if action.tool == FINISH_TOOL and observation.ok:
                status = "completed"
                summary = observation.output
                break

            if observation.ok:
                consecutive_failures = 0
            else:
                consecutive_failures += 1
                if consecutive_failures >= self.failure_limit:
                    status = "failed"
                    summary = (
                        f"Giving up after {consecutive_failures} consecutive failures; "
                        f"last error: {observation.error}"
                    )
                    break

        result = RunResult(
            goal=goal,
            status=status,
            steps=steps,
            summary=summary,
            started_at=started_at,
            finished_at=utcnow(),
        )
        if self.journal:
            self.journal.run_finished(result)
        logger.info("run finished: %s (%s)", goal.name, status)
        return result

    def _execute(self, action: Action, ctx: ToolContext) -> Observation:
        """Run one tool call, turning every failure into an Observation."""
        start = time.monotonic()
        try:
            entry = self.registry.get(action.tool)
            output = entry.call(action.args, ctx)
        except ToolError as exc:
            return Observation.failure(str(exc), time.monotonic() - start)
        except Exception as exc:  # a tool bug must not take the bot down
            logger.exception("tool %s raised", action.tool)
            return Observation.failure(
                f"{action.tool} raised {type(exc).__name__}: {exc}", time.monotonic() - start
            )
        return Observation(
            ok=True,
            output="" if output is None else str(output),
            elapsed_s=time.monotonic() - start,
        )
