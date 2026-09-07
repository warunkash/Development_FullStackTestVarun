"""Shared types for publishing targets."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class UploadRequest:
    """Everything a platform needs to post one video."""

    video_path: Path
    title: str
    description: str
    tags: list[str] = field(default_factory=list)
    privacy: str = "public"

    def hashtag_line(self, limit: int = 8) -> str:
        return " ".join(f"#{tag}" for tag in self.tags[:limit])


@dataclass
class PublishResult:
    """Outcome of one publish attempt."""

    platform: str
    ok: bool
    url: str = ""
    detail: str = ""

    def __str__(self) -> str:
        status = "ok" if self.ok else "failed"
        return f"{self.platform}: {status} {self.url or self.detail}".strip()


class Target:
    """Base class for a publishing target."""

    name = "base"
    #: Environment variables that must be present for this target to run.
    required_env: tuple[str, ...] = ()

    def missing_env(self) -> list[str]:
        return [key for key in self.required_env if not os.environ.get(key)]

    def available(self) -> bool:
        return not self.missing_env()

    def publish(self, request: UploadRequest, timeout: float) -> PublishResult:
        raise NotImplementedError
