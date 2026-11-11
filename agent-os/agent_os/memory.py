"""Memory that outlives the context window.

Two shapes, one SQLite file:

* **facts**  — namespaced key/value the agent reads and overwrites. Survives
  restarts, so an agent can be stopped mid-task and resumed.
* **episodes** — an append-only log of what happened, searchable later. This is
  what you scroll back through when the context window has long since dropped
  the details.

SQLite because it is in the standard library, it is a single file you can copy,
and it gives us atomic writes without running a server.
"""

from __future__ import annotations

import json
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator

_SCHEMA = """
CREATE TABLE IF NOT EXISTS facts (
    namespace TEXT NOT NULL,
    key       TEXT NOT NULL,
    value     TEXT NOT NULL,
    updated   REAL NOT NULL,
    PRIMARY KEY (namespace, key)
);

CREATE TABLE IF NOT EXISTS episodes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    namespace TEXT NOT NULL,
    run_id    TEXT,
    kind      TEXT NOT NULL,
    body      TEXT NOT NULL,
    created   REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS episodes_ns_created ON episodes (namespace, created);
"""


@dataclass(frozen=True)
class Episode:
    id: int
    namespace: str
    run_id: str | None
    kind: str
    body: str
    created: float


class Memory:
    """Persistent store, scoped by namespace.

    A namespace is normally one agent, or one long-running task. Nothing stops
    two agents sharing one, but they will overwrite each other's facts.
    """

    def __init__(self, path: str | Path = ":memory:", namespace: str = "default"):
        self.path = str(path)
        self.namespace = namespace
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        # check_same_thread=False so a kernel running tools in a worker thread
        # can still write. Writes are serialised by SQLite's own locking.
        self._db = sqlite3.connect(self.path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._db.executescript(_SCHEMA)
        self._db.commit()

    # -- facts ----------------------------------------------------------------

    def remember(self, key: str, value: Any) -> None:
        """Store (or replace) one fact. `value` must be JSON-serialisable."""
        self._db.execute(
            "INSERT INTO facts (namespace, key, value, updated) VALUES (?, ?, ?, ?) "
            "ON CONFLICT (namespace, key) DO UPDATE SET value=excluded.value, updated=excluded.updated",
            (self.namespace, key, json.dumps(value), time.time()),
        )
        self._db.commit()

    def recall(self, key: str, default: Any = None) -> Any:
        row = self._db.execute(
            "SELECT value FROM facts WHERE namespace=? AND key=?", (self.namespace, key)
        ).fetchone()
        return default if row is None else json.loads(row["value"])

    def forget(self, key: str) -> bool:
        cur = self._db.execute(
            "DELETE FROM facts WHERE namespace=? AND key=?", (self.namespace, key)
        )
        self._db.commit()
        return cur.rowcount > 0

    def keys(self) -> list[str]:
        rows = self._db.execute(
            "SELECT key FROM facts WHERE namespace=? ORDER BY key", (self.namespace,)
        ).fetchall()
        return [r["key"] for r in rows]

    # -- episodes -------------------------------------------------------------

    def record(self, kind: str, body: str, run_id: str | None = None) -> int:
        """Append one episode. Returns its id."""
        cur = self._db.execute(
            "INSERT INTO episodes (namespace, run_id, kind, body, created) VALUES (?, ?, ?, ?, ?)",
            (self.namespace, run_id, kind, body, time.time()),
        )
        self._db.commit()
        return int(cur.lastrowid)

    def episodes(
        self, kind: str | None = None, run_id: str | None = None, limit: int = 50
    ) -> list[Episode]:
        """Most recent episodes first."""
        sql = "SELECT * FROM episodes WHERE namespace=?"
        args: list[Any] = [self.namespace]
        if kind is not None:
            sql += " AND kind=?"
            args.append(kind)
        if run_id is not None:
            sql += " AND run_id=?"
            args.append(run_id)
        sql += " ORDER BY id DESC LIMIT ?"
        args.append(limit)
        return [Episode(**dict(r)) for r in self._db.execute(sql, args).fetchall()]

    def search(self, needle: str, limit: int = 20) -> list[Episode]:
        """Substring search over episode bodies.

        Deliberately not embeddings: this layer should not drag in a model or a
        vector store. Swap in whatever retrieval you want by subclassing.
        """
        rows = self._db.execute(
            "SELECT * FROM episodes WHERE namespace=? AND body LIKE ? ORDER BY id DESC LIMIT ?",
            (self.namespace, f"%{needle}%", limit),
        ).fetchall()
        return [Episode(**dict(r)) for r in rows]

    # -- lifecycle ------------------------------------------------------------

    def scoped(self, namespace: str) -> "Memory":
        """A second handle onto the same file, different namespace."""
        return Memory(self.path, namespace)

    def close(self) -> None:
        self._db.close()

    def __enter__(self) -> "Memory":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def __iter__(self) -> Iterator[str]:
        return iter(self.keys())
