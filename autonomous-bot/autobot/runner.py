"""Runtime hosts.

The same agent runs two ways:

* :func:`run_once` - execute one task and exit. This is what the CLI and the
  GitHub Actions job call.
* :class:`Runner` - a long-running daemon that runs tasks on their intervals,
  backs off tasks that keep failing, and shuts down cleanly on SIGTERM/SIGINT.
"""

from __future__ import annotations

import logging
import random
import signal
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

from .agent import Agent
from .builtins import default_registry
from .config import BotConfig, TaskSpec
from .memory import Journal
from .models import RunResult
from .policy import build_policy
from .tools import ToolRegistry

logger = logging.getLogger("autobot.runner")

#: Never wait longer than this between retries of a failing task.
MAX_BACKOFF_S = 3600.0


def build_registry(config: BotConfig, extra_tools: list[Any] | None = None) -> ToolRegistry:
    """Assemble the tool registry for a run, honouring the dangerous-tool gate."""
    registry = default_registry(include_dangerous=config.allow_dangerous_tools)
    for entry in extra_tools or []:
        registry.add(entry)
    return registry


def run_id_for(task_name: str) -> str:
    """A filesystem-safe, sortable run identifier."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    safe = "".join(c if c.isalnum() or c in "-_" else "-" for c in task_name)
    return f"{safe}-{stamp}"


def build_agent(
    config: BotConfig,
    spec: TaskSpec,
    registry: ToolRegistry | None = None,
    journal: Journal | None = None,
    policy: Any = None,
) -> Agent:
    """Wire a policy, tools and a journal into an :class:`Agent`."""
    registry = registry or build_registry(config)
    goal = spec.to_goal()
    if policy is None:
        kwargs: dict[str, Any] = {}
        if config.policy.strip().lower() in {"claude", "llm", "anthropic"}:
            kwargs = {
                "model": config.model,
                "effort": config.effort,
                "max_tokens": config.max_tokens,
            }
        policy = build_policy(config.policy, goal=goal, **kwargs)
    return Agent(
        policy=policy,
        registry=registry,
        workspace=config.workspace,
        journal=journal,
        config=config,
        failure_limit=config.failure_limit,
    )


def run_once(config: BotConfig, task_name: str, policy: Any = None) -> RunResult:
    """Run a single named task to completion and return its result."""
    spec = config.task(task_name)
    journal = Journal(config.journal_dir, run_id_for(spec.name))
    agent = build_agent(config, spec, journal=journal, policy=policy)
    return agent.run(spec.to_goal())


@dataclass
class ScheduledTask:
    """A task plus the scheduler's bookkeeping for it."""

    spec: TaskSpec
    next_run_at: float = 0.0
    consecutive_failures: int = 0
    runs: int = 0
    last_status: str | None = None

    def delay_after(self, ok: bool, jitter: Callable[[], float] = random.random) -> float:
        """Seconds to wait before the next run: the interval, or a backoff."""
        if ok:
            return self.spec.interval_s
        # Exponential backoff with jitter, so a broken dependency is not hammered.
        backoff = self.spec.interval_s * (2 ** min(self.consecutive_failures, 8))
        capped = min(backoff, MAX_BACKOFF_S)
        return capped * (0.75 + 0.5 * jitter())


class Runner:
    """Runs enabled tasks on their intervals until asked to stop."""

    def __init__(
        self,
        config: BotConfig,
        registry: ToolRegistry | None = None,
        policy_factory: Callable[[TaskSpec], Any] | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.config = config
        self.registry = registry or build_registry(config)
        self.policy_factory = policy_factory
        self.clock = clock
        self._stop = threading.Event()
        self.tasks: list[ScheduledTask] = [
            ScheduledTask(spec=spec) for spec in config.enabled_tasks
        ]
        self.results: list[RunResult] = []

    def request_stop(self, *_: Any) -> None:
        """Ask the loop to finish the current task and exit."""
        if not self._stop.is_set():
            logger.info("shutdown requested; finishing the current task")
        self._stop.set()

    def install_signal_handlers(self) -> None:
        """Route SIGTERM/SIGINT into a graceful stop (main thread only)."""
        for sig in (signal.SIGTERM, signal.SIGINT):
            try:
                signal.signal(sig, self.request_stop)
            except ValueError:  # not on the main thread
                logger.debug("could not install handler for %s", sig)

    def serve(self, max_cycles: int | None = None) -> list[RunResult]:
        """Run the scheduling loop.

        Args:
            max_cycles: Stop after this many task executions. ``None`` runs
                until a stop is requested - tests pass a small number.
        """
        if not self.tasks:
            logger.warning("no enabled tasks; nothing to do")
            return []

        logger.info(
            "daemon started with %d task(s): %s",
            len(self.tasks),
            ", ".join(t.spec.name for t in self.tasks),
        )
        cycles = 0
        now = self.clock()
        for task in self.tasks:
            task.next_run_at = now

        while not self._stop.is_set():
            if max_cycles is not None and cycles >= max_cycles:
                break

            due = min(self.tasks, key=lambda t: t.next_run_at)
            wait = due.next_run_at - self.clock()
            if wait > 0:
                # Event.wait returns early when a stop arrives, so shutdown is
                # never blocked behind a long interval.
                if self._stop.wait(timeout=wait):
                    break

            self._run_task(due)
            cycles += 1

        logger.info("daemon stopped after %d run(s)", cycles)
        return self.results

    def _run_task(self, task: ScheduledTask) -> None:
        spec = task.spec
        journal = Journal(self.config.journal_dir, run_id_for(spec.name))
        policy = self.policy_factory(spec) if self.policy_factory else None
        agent = build_agent(
            self.config, spec, registry=self.registry, journal=journal, policy=policy
        )

        try:
            result = agent.run(spec.to_goal())
            ok = result.ok
            task.last_status = result.status
        except Exception as exc:
            # A crash in one task must not stop the daemon.
            logger.exception("task '%s' crashed", spec.name)
            ok = False
            task.last_status = f"crashed: {exc}"
            result = None

        task.runs += 1
        task.consecutive_failures = 0 if ok else task.consecutive_failures + 1
        if result is not None:
            self.results.append(result)

        delay = task.delay_after(ok)
        task.next_run_at = self.clock() + delay
        logger.info(
            "task '%s' -> %s; next run in %.0fs%s",
            spec.name,
            task.last_status,
            delay,
            f" (failure {task.consecutive_failures})" if not ok else "",
        )
