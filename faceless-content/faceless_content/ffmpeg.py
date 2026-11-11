"""Thin wrappers around the ffmpeg/ffprobe binaries."""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
from pathlib import Path

from .errors import RenderError

logger = logging.getLogger(__name__)


def require(binary: str) -> str:
    """Return the resolved path to ``binary`` or raise with an actionable message."""
    resolved = shutil.which(binary)
    if resolved is None:
        raise RenderError(
            f"{binary!r} not found on PATH. Install ffmpeg "
            "(apt-get install ffmpeg / brew install ffmpeg) and retry."
        )
    return resolved


def run(
    cmd: list[str],
    timeout: float = 900.0,
    what: str = "ffmpeg",
    cwd: str | Path | None = None,
) -> None:
    """Run an ffmpeg-family command, raising RenderError with stderr on failure."""
    logger.debug("%s: %s", what, " ".join(cmd))
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, check=False, cwd=cwd
        )
    except subprocess.TimeoutExpired as exc:
        raise RenderError(f"{what} timed out after {timeout:.0f}s") from exc
    if result.returncode != 0:
        tail = "\n".join(result.stderr.strip().splitlines()[-15:])
        raise RenderError(f"{what} failed (exit {result.returncode}):\n{tail}")


def probe_duration(path: str | Path, ffprobe_bin: str = "ffprobe", timeout: float = 60.0) -> float:
    """Return the duration of a media file in seconds."""
    cmd = [
        require(ffprobe_bin),
        "-v", "error",
        "-print_format", "json",
        "-show_format",
        str(path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=False)
    except subprocess.TimeoutExpired as exc:
        raise RenderError(f"ffprobe timed out on {path}") from exc
    if result.returncode != 0:
        raise RenderError(f"ffprobe could not read {path}: {result.stderr.strip()[:300]}")
    try:
        return float(json.loads(result.stdout)["format"]["duration"])
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        raise RenderError(f"ffprobe returned no duration for {path}") from exc
