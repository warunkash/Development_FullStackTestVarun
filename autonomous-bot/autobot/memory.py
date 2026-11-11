"""Run journal - an append-only record of everything the bot did.

Autonomous runs are only trustworthy if you can reconstruct them afterwards, so
every step is flushed to a JSONL file as it happens rather than at the end. A
run that is killed mid-flight still leaves a readable trail.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Iterator

from .models import RunResult, Step

logger = logging.getLogger("autobot.memory")


class Journal:
    """Appends run events to ``<dir>/<run_id>.jsonl``."""

    def __init__(self, directory: str | Path, run_id: str) -> None:
        self.directory = Path(directory)
        self.run_id = run_id
        self.path = self.directory / f"{run_id}.jsonl"
        self.directory.mkdir(parents=True, exist_ok=True)

    def _write(self, kind: str, payload: dict[str, Any]) -> None:
        record = {"kind": kind, "run_id": self.run_id, **payload}
        try:
            with self.path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(record, default=str) + "\n")
        except OSError as exc:  # a broken journal must not kill the run
            logger.warning("could not write to journal %s: %s", self.path, exc)

    def run_started(self, goal_dict: dict[str, Any], policy: str) -> None:
        self._write("run_started", {"goal": goal_dict, "policy": policy})

    def step(self, step: Step) -> None:
        self._write("step", step.to_dict())

    def run_finished(self, result: RunResult) -> None:
        self._write(
            "run_finished",
            {
                "status": result.status,
                "summary": result.summary,
                "step_count": len(result.steps),
                "failures": result.failures,
                "finished_at": result.finished_at,
            },
        )

    def read(self) -> Iterator[dict[str, Any]]:
        """Replay the journal, skipping any line that got truncated."""
        if not self.path.exists():
            return
        with self.path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    logger.warning("skipping malformed journal line in %s", self.path)
