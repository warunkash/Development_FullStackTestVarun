"""Durable record of what has already been made, so topics are not repeated."""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)
_SPACE = re.compile(r"\s+")
_STOPWORDS = frozenset(
    "a an the of in on at to for and or is are was were be been by with from "
    "how why what when who this that it its as new".split()
)


def topic_key(title: str) -> str:
    """Collapse a headline into a stable key so near-duplicates dedupe together."""
    text = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    text = _PUNCT.sub(" ", text.lower())
    words = [w for w in _SPACE.split(text) if w and w not in _STOPWORDS]
    return " ".join(sorted(words))


@dataclass
class Entry:
    """One completed pipeline run."""

    key: str
    title: str
    created_at: str
    video_path: str = ""
    published: dict[str, str] = field(default_factory=dict)


class State:
    """JSON-backed history of produced videos."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.entries: list[Entry] = []
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return
        try:
            raw: Any = json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            # A truncated state file must not take the whole pipeline down.
            return
        for item in raw.get("entries", []):
            if isinstance(item, dict) and "key" in item:
                self.entries.append(
                    Entry(
                        key=item["key"],
                        title=item.get("title", ""),
                        created_at=item.get("created_at", ""),
                        video_path=item.get("video_path", ""),
                        published=item.get("published", {}) or {},
                    )
                )

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"version": 1, "entries": [asdict(e) for e in self.entries]}
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        tmp.replace(self.path)

    def used_recently(self, title: str, cooldown_days: int, now: datetime | None = None) -> bool:
        """True when this topic was produced inside the cooldown window."""
        if cooldown_days <= 0:
            return False
        key = topic_key(title)
        cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=cooldown_days)
        for entry in self.entries:
            if entry.key != key:
                continue
            try:
                created = datetime.fromisoformat(entry.created_at)
            except ValueError:
                return True  # unparseable timestamp: assume recent and skip
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            if created >= cutoff:
                return True
        return False

    def record(
        self,
        title: str,
        video_path: str = "",
        published: dict[str, str] | None = None,
        now: datetime | None = None,
    ) -> Entry:
        """Append a completed run and persist it."""
        entry = Entry(
            key=topic_key(title),
            title=title,
            created_at=(now or datetime.now(timezone.utc)).isoformat(),
            video_path=video_path,
            published=published or {},
        )
        self.entries.append(entry)
        self.save()
        return entry
