"""The kill switch.

Two ways to trip it, because the two situations are different:

* **In-process** — ``switch.trip("reason")`` from a supervising thread.
* **Out-of-process** — ``touch /tmp/agent.stop``. This is the one that matters
  at 3am: you do not need a handle on the object, or even the same machine, if
  the file lives on a shared volume. Deleting the file re-arms it.

The kernel checks before every step, so the worst case is that the current tool
call finishes first.
"""

from __future__ import annotations

import threading
from pathlib import Path

from .errors import Killed


class KillSwitch:
    def __init__(self, path: str | Path | None = None):
        self.path = Path(path).expanduser() if path else None
        self._tripped = threading.Event()
        self._reason = "killed"

    def trip(self, reason: str = "killed by supervisor") -> None:
        self._reason = reason
        self._tripped.set()

    def reset(self) -> None:
        """Re-arm: clear the in-process flag and remove the sentinel file."""
        self._tripped.clear()
        self._reason = "killed"
        if self.path is not None and self.path.exists():
            self.path.unlink()

    @property
    def tripped(self) -> bool:
        if self._tripped.is_set():
            return True
        if self.path is not None and self.path.exists():
            self._reason = f"kill file present: {self.path}"
            return True
        return False

    @property
    def reason(self) -> str:
        return self._reason

    def check(self) -> None:
        if self.tripped:
            raise Killed(self._reason)
