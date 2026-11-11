"""Budget and step ceilings — the thing that stops a runaway loop.

Three independent ceilings, because loops run away in three different ways:

* **steps**   — the agent oscillates between two tools forever
* **seconds** — one call hangs, or each is slow enough to matter
* **cost**    — each step is cheap but there are thousands of them

Whichever binds first stops the run. The kernel checks before each step and
charges after each one, so a tool can never be entered without headroom.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from .errors import BudgetExceeded


@dataclass
class Budget:
    max_steps: int = 25
    max_seconds: float | None = None
    max_cost: float | None = None
    # Ceilings apply per run by default: an AgentSpec reused for a second run
    # starts fresh. Set True for a lifetime cap across every run of this spec.
    carry_over: bool = False

    steps_used: int = 0
    cost_used: float = 0.0
    started: float = field(default_factory=time.monotonic)

    def __post_init__(self) -> None:
        if self.max_steps < 1:
            raise ValueError("max_steps must be at least 1")

    # -- accounting -----------------------------------------------------------

    def start(self) -> None:
        """Begin a run.

        Resets the clock, and — unless `carry_over` is set — the step and cost
        counters too. Without this, a spec reused for a second run arrives
        pre-charged with the first run's spend.
        """
        self.started = time.monotonic()
        if not self.carry_over:
            self.steps_used = 0
            self.cost_used = 0.0

    def charge(self, steps: int = 1, cost: float = 0.0) -> None:
        self.steps_used += steps
        self.cost_used += cost

    # -- enforcement ----------------------------------------------------------

    @property
    def elapsed(self) -> float:
        return time.monotonic() - self.started

    def remaining_steps(self) -> int:
        return max(0, self.max_steps - self.steps_used)

    def check(self, next_cost: float = 0.0) -> None:
        """Raise `BudgetExceeded` if another step of `next_cost` cannot be afforded."""
        if self.steps_used >= self.max_steps:
            raise BudgetExceeded(
                f"step ceiling reached: {self.steps_used}/{self.max_steps} steps"
            )
        if self.max_seconds is not None and self.elapsed >= self.max_seconds:
            raise BudgetExceeded(
                f"time ceiling reached: {self.elapsed:.1f}s/{self.max_seconds}s"
            )
        if self.max_cost is not None and self.cost_used + next_cost > self.max_cost:
            raise BudgetExceeded(
                f"cost ceiling would be exceeded: "
                f"{self.cost_used:.4f} + {next_cost:.4f} > {self.max_cost:.4f}"
            )

    def snapshot(self) -> dict[str, float | int | None]:
        return {
            "steps_used": self.steps_used,
            "max_steps": self.max_steps,
            "cost_used": round(self.cost_used, 6),
            "max_cost": self.max_cost,
            "elapsed": round(self.elapsed, 3),
            "max_seconds": self.max_seconds,
        }
