"""The orchestrator: discovery through publish, in one call."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from .captions import build_cues, write_ass
from .config import Config
from .discovery import Topic, discover
from .errors import PipelineError
from .publish import PublishResult, UploadRequest, publish_all
from .render import render
from .scripting import VideoScript, write_script
from .state import State
from .visuals import acquire
from .voice import synthesize

logger = logging.getLogger(__name__)

_SLUG_STRIP = re.compile(r"[^a-z0-9]+")


def slugify(text: str, max_length: int = 48) -> str:
    """Turn a title into a filesystem-safe directory name."""
    slug = _SLUG_STRIP.sub("-", text.lower()).strip("-")
    return slug[:max_length].strip("-") or "untitled"


@dataclass
class PipelineResult:
    """Everything one run produced."""

    topic: str
    title: str
    video_path: Path
    duration: float
    script: VideoScript
    voice_backend: str
    sources: list[str] = field(default_factory=list)
    publish_results: list[PublishResult] = field(default_factory=list)
    run_dir: Path | None = None

    @property
    def published_urls(self) -> dict[str, str]:
        return {r.platform: r.url for r in self.publish_results if r.ok and r.url}


def build_description(script: VideoScript, topic: Topic | None, cfg: Config) -> str:
    """Assemble the platform description from the script and its source."""
    parts = [script.hook]
    if topic is not None and topic.url:
        parts.append(f"Source: {topic.url}")
    if cfg.publish.description_footer:
        parts.append(cfg.publish.description_footer)
    hashtags = " ".join(f"#{tag}" for tag in script.hashtags[: cfg.publish.hashtag_limit])
    if hashtags:
        parts.append(hashtags)
    return "\n\n".join(part for part in parts if part)


def run(
    cfg: Config,
    dry_run: bool = True,
    topic_override: str | None = None,
    summary_override: str = "",
) -> PipelineResult:
    """Run the full pipeline once and return what it produced.

    ``dry_run`` only affects publishing - the video is always rendered, so a dry
    run is a real rehearsal of everything except the irreversible step.
    """
    state = State(cfg.state_path)

    if topic_override:
        topic = Topic(title=topic_override, score=1.0, sources=["manual"], summary=summary_override)
    else:
        ranked = discover(cfg.discovery, state, tuple(cfg.blocklist_extra))
        topic = ranked[0]
        logger.info(
            "topic: %r (score %.2f, sources %s)", topic.title, topic.score, ", ".join(topic.sources)
        )

    run_dir = Path(cfg.output_dir) / f"{datetime.now(timezone.utc):%Y%m%d}-{slugify(topic.title)}"
    run_dir.mkdir(parents=True, exist_ok=True)

    script = write_script(topic.title, topic.summary, cfg.script)
    logger.info(
        "script by %s: %d words, ~%.0fs",
        script.writer,
        script.word_count(),
        script.estimated_seconds(cfg.script.words_per_second),
    )

    narration = script.narration()
    voice = synthesize(narration, run_dir, cfg.voice, cfg.render.ffprobe_bin)

    queries = script.visual_queries or [topic.title]
    clips = acquire(queries, voice.duration, run_dir / "clips", cfg.visuals, cfg.render)

    subtitles = None
    if cfg.captions.enabled:
        cues = build_cues(narration, voice.duration, cfg.captions)
        subtitles = write_ass(
            cues, run_dir / "captions.ass", cfg.captions, cfg.render.width, cfg.render.height
        )

    video_path = run_dir / f"{slugify(topic.title)}.mp4"
    rendered = render(
        clips, voice.path, video_path, cfg.render, subtitles, workdir=run_dir / "work"
    )

    title = script.title
    if cfg.publish.title_suffix:
        title = f"{title} {cfg.publish.title_suffix}".strip()

    request = UploadRequest(
        video_path=rendered.path,
        title=title,
        description=build_description(script, topic, cfg),
        tags=script.hashtags,
        privacy=cfg.publish.privacy,
    )
    results = publish_all(request, cfg.publish, dry_run=dry_run)
    for result in results:
        logger.info("publish %s", result)

    result = PipelineResult(
        topic=topic.title,
        title=title,
        video_path=rendered.path,
        duration=rendered.duration,
        script=script,
        voice_backend=voice.backend,
        sources=topic.sources,
        publish_results=results,
        run_dir=run_dir,
    )

    (run_dir / "metadata.json").write_text(
        json.dumps(
            {
                "topic": topic.title,
                "title": title,
                "description": request.description,
                "sources": topic.sources,
                "score": topic.score,
                "script": asdict(script),
                "voice_backend": voice.backend,
                "duration": rendered.duration,
                "video": str(rendered.path),
                "dry_run": dry_run,
                "published": [asdict(r) for r in results],
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    # Only a real publish should burn the topic; a dry run must stay repeatable.
    if not dry_run:
        state.record(topic.title, str(rendered.path), result.published_urls)

    return result


def run_safely(cfg: Config, **kwargs) -> PipelineResult | None:
    """Run the pipeline, logging rather than raising on a deliberate failure."""
    try:
        return run(cfg, **kwargs)
    except PipelineError as exc:
        logger.error("pipeline stopped: %s", exc)
        return None
