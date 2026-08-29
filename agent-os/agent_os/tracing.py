"""Full traces — so you can see why a run failed, after it failed.

One JSONL file per run. Append-only, flushed on every write, readable with
``tail -f`` while the agent is still going. A crashed process still leaves every
event up to the crash on disk, which is the entire point: the interesting run is
always the one you were not watching.

Arguments and results are truncated to keep a stuck loop from filling the disk;
the untruncated length is recorded so you know it happened.
"""

from __future__ import annotations

import json
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterator

MAX_REPR = 2000


def _clip(value: Any) -> Any:
    """JSON-safe, bounded rendering of arbitrary tool input/output."""
    try:
        text = json.dumps(value, default=str)
    except (TypeError, ValueError):
        text = repr(value)
    if len(text) <= MAX_REPR:
        try:
            return json.loads(text)
        except (TypeError, ValueError):
            return text
    return {"_truncated": True, "_length": len(text), "_head": text[:MAX_REPR]}


@dataclass
class Event:
    seq: int
    ts: float
    kind: str  # run_start | step | tool_result | tool_error | halt | run_end
    data: dict[str, Any] = field(default_factory=dict)


class Trace:
    """The record of one run."""

    def __init__(self, run_id: str | None = None, path: str | Path | None = None):
        self.run_id = run_id or uuid.uuid4().hex[:12]
        self.events: list[Event] = []
        self._seq = 0
        self._fh = None
        if path is not None:
            p = Path(path).expanduser()
            p.parent.mkdir(parents=True, exist_ok=True)
            self._fh = p.open("a", encoding="utf-8")
        self.path = Path(path).expanduser() if path else None

    def emit(self, kind: str, **data: Any) -> Event:
        self._seq += 1
        event = Event(seq=self._seq, ts=time.time(), kind=kind, data={k: _clip(v) for k, v in data.items()})
        self.events.append(event)
        if self._fh is not None:
            self._fh.write(json.dumps({"run_id": self.run_id, **asdict(event)}) + "\n")
            self._fh.flush()
        return event

    # -- reading it back ------------------------------------------------------

    def of_kind(self, kind: str) -> list[Event]:
        return [e for e in self.events if e.kind == kind]

    @property
    def failed(self) -> bool:
        return bool(self.of_kind("halt")) or bool(self.of_kind("tool_error"))

    def why(self) -> str:
        """One line explaining how the run ended. The question you actually ask."""
        halts = self.of_kind("halt")
        if halts:
            last = halts[-1].data
            return f"{last.get('reason', 'halted')}: {last.get('detail', '')}".strip(": ")
        errors = self.of_kind("tool_error")
        if errors:
            last = errors[-1].data
            return f"last tool error in {last.get('tool')}: {last.get('error')}"
        if self.of_kind("run_end"):
            return f"completed in {self.steps} step(s)"
        return "no terminal event recorded"

    @property
    def steps(self) -> int:
        """Steps that actually executed a tool — not planner turns.

        The terminal `finish` action is a step event too, so counting raw
        `step` events overstates the run by one on every clean finish.
        """
        ends = self.of_kind("run_end")
        if ends:
            return int(ends[-1].data.get("steps", 0))
        return len([e for e in self.of_kind("step") if e.data.get("tool")])

    def summary(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "events": len(self.events),
            "steps": self.steps,
            "tool_errors": len(self.of_kind("tool_error")),
            "failed": self.failed,
            "why": self.why(),
        }

    def close(self) -> None:
        if self._fh is not None:
            self._fh.close()
            self._fh = None

    def __iter__(self) -> Iterator[Event]:
        return iter(self.events)

    def __len__(self) -> int:
        return len(self.events)


def read_trace(path: str | Path) -> list[dict[str, Any]]:
    """Load a JSONL trace written by an earlier run.

    Skips malformed trailing lines, which is what you get if the process was
    killed mid-write — exactly the run you most want to read.
    """
    out: list[dict[str, Any]] = []
    with Path(path).expanduser().open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out
