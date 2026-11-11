"""Background footage for each beat of the script.

Pexels supplies real stock video when a key is present. The gradient provider
is the always-available fallback: an animated colour field that reads well
behind large captions, which is the dominant look for text-led faceless
content anyway.
"""

from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import dataclass
from pathlib import Path

import requests

from .config import RenderConfig, VisualsConfig
from .errors import VisualsError
from .ffmpeg import require, run

logger = logging.getLogger(__name__)

PEXELS_SEARCH = "https://api.pexels.com/videos/search"


@dataclass
class VisualClip:
    """One background clip, already on disk."""

    path: Path
    source: str
    query: str = ""


def _hex_to_ffmpeg(colour: str) -> str:
    """Convert ``#rrggbb`` to the ``0xrrggbb`` form ffmpeg's gradients filter wants."""
    value = colour.strip().lstrip("#")
    if len(value) != 6 or any(c not in "0123456789abcdefABCDEF" for c in value):
        raise VisualsError(f"invalid gradient colour {colour!r}, expected #rrggbb")
    return f"0x{value.lower()}"


class GradientProvider:
    """Synthesises an animated gradient clip locally. Never fails on network."""

    name = "gradient"

    def available(self) -> bool:
        return True

    def fetch(
        self,
        query: str,
        index: int,
        duration: float,
        out_dir: Path,
        cfg: VisualsConfig,
        render: RenderConfig,
    ) -> VisualClip:
        palette = cfg.gradient_palette or [["#12002e", "#5b0f8b"]]
        start, end = palette[index % len(palette)][:2]
        out_path = out_dir / f"clip{index:02d}_gradient.mp4"
        spec = (
            f"gradients=s={render.width}x{render.height}"
            f":c0={_hex_to_ffmpeg(start)}:c1={_hex_to_ffmpeg(end)}"
            f":speed=0.006:d={duration:.3f}:r={render.fps}"
        )
        cmd = [
            require(render.ffmpeg_bin),
            "-y", "-v", "error",
            "-f", "lavfi", "-i", spec,
            "-t", f"{duration:.3f}",
            "-vf", "vignette=PI/5,format=yuv420p",
            "-c:v", render.video_codec, "-preset", render.preset, "-crf", str(render.crf),
            str(out_path),
        ]
        run(cmd, render.timeout, what="gradient background")
        return VisualClip(path=out_path, source=self.name, query=query)


class PexelsProvider:
    """Stock footage from Pexels. Requires PEXELS_API_KEY."""

    name = "pexels"

    def available(self) -> bool:
        return bool(os.environ.get("PEXELS_API_KEY"))

    def _pick_file(self, videos: list[dict], min_height: int) -> str:
        """Choose the smallest file that still clears the target resolution."""
        best: tuple[int, str] | None = None
        for video in videos:
            for file in video.get("video_files", []):
                if file.get("file_type") != "video/mp4" or not file.get("link"):
                    continue
                height = int(file.get("height") or 0)
                width = int(file.get("width") or 0)
                if height < min_height or width > height:
                    continue
                if best is None or height < best[0]:
                    best = (height, file["link"])
        if best is None:
            raise VisualsError("no portrait mp4 in the Pexels result")
        return best[1]

    def fetch(
        self,
        query: str,
        index: int,
        duration: float,
        out_dir: Path,
        cfg: VisualsConfig,
        render: RenderConfig,
    ) -> VisualClip:
        response = requests.get(
            PEXELS_SEARCH,
            timeout=cfg.request_timeout,
            headers={"Authorization": os.environ["PEXELS_API_KEY"]},
            params={"query": query, "orientation": cfg.orientation, "per_page": 8},
        )
        if response.status_code >= 400:
            raise VisualsError(f"Pexels returned {response.status_code}: {response.text[:200]}")
        videos = response.json().get("videos", [])
        if not videos:
            raise VisualsError(f"Pexels has no footage for {query!r}")

        link = self._pick_file(videos, min_height=min(1280, render.height))
        digest = hashlib.sha1(link.encode()).hexdigest()[:10]
        out_path = out_dir / f"clip{index:02d}_pexels_{digest}.mp4"

        with requests.get(link, timeout=cfg.request_timeout, stream=True) as download:
            download.raise_for_status()
            with out_path.open("wb") as handle:
                for block in download.iter_content(chunk_size=1 << 16):
                    handle.write(block)

        if out_path.stat().st_size == 0:
            raise VisualsError(f"Pexels download for {query!r} was empty")
        return VisualClip(path=out_path, source=self.name, query=query)


PROVIDERS = {p.name: p for p in (PexelsProvider(), GradientProvider())}
_AUTO_ORDER = ("pexels", "gradient")


def select_providers(cfg: VisualsConfig) -> list:
    """Resolve the configured provider into an ordered candidate list."""
    choice = (cfg.provider or "auto").lower()
    if choice == "auto":
        return [PROVIDERS[name] for name in _AUTO_ORDER if PROVIDERS[name].available()]
    provider = PROVIDERS.get(choice)
    if provider is None:
        raise VisualsError(f"unknown visuals provider {cfg.provider!r}")
    return [provider]


def plan_durations(total: float, count: int, per_beat: float = 0.0) -> list[float]:
    """Split the voiceover across ``count`` clips, giving the last one the remainder."""
    if count <= 0:
        raise VisualsError("cannot plan visuals for zero clips")
    if per_beat > 0:
        durations = [per_beat] * count
        used = per_beat * count
        if used < total:
            durations[-1] += total - used
        return durations
    slot = total / count
    durations = [slot] * count
    durations[-1] = total - slot * (count - 1)
    return durations


def acquire(
    queries: list[str],
    total_duration: float,
    out_dir: Path,
    cfg: VisualsConfig,
    render: RenderConfig,
) -> list[tuple[VisualClip, float]]:
    """Fetch one background clip per query, paired with the seconds it must fill."""
    queries = [q for q in queries if q.strip()][: cfg.max_clips] or ["abstract background"]
    durations = plan_durations(total_duration, len(queries), cfg.per_beat_seconds)

    providers = select_providers(cfg)
    if not providers:
        raise VisualsError("no visuals provider available")

    out_dir.mkdir(parents=True, exist_ok=True)
    results: list[tuple[VisualClip, float]] = []
    for index, (query, duration) in enumerate(zip(queries, durations)):
        clip: VisualClip | None = None
        for provider in providers:
            try:
                clip = provider.fetch(query, index, duration, out_dir, cfg, render)
                break
            except Exception as exc:  # noqa: BLE001 - fall through to the next provider
                logger.warning("visuals provider %s failed for %r: %s", provider.name, query, exc)
        if clip is None:
            raise VisualsError(f"every visuals provider failed for {query!r}")
        results.append((clip, duration))
    return results
