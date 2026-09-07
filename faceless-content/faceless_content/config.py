"""Configuration loading: YAML/JSON on disk, environment for anything secret."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field, fields
from pathlib import Path
from typing import Any

from .errors import ConfigError

_ENV_REF = re.compile(r"\$\{([A-Z0-9_]+)(?::-([^}]*))?\}")


@dataclass
class DiscoveryConfig:
    """Where 'most viewed right now' is read from, and how sources are weighted."""

    sources: list[str] = field(
        default_factory=lambda: ["wikipedia", "google_trends", "reddit", "hacker_news"]
    )
    # Relative trust in each source's view/engagement signal.
    weights: dict[str, float] = field(
        default_factory=lambda: {
            "wikipedia": 1.0,
            "youtube": 1.0,
            "google_trends": 0.9,
            "reddit": 0.7,
            "hacker_news": 0.5,
        }
    )
    geo: str = "US"
    subreddits: list[str] = field(
        default_factory=lambda: ["todayilearned", "explainlikeimfive", "science"]
    )
    candidates_per_source: int = 25
    # A topic corroborated by several sources gets this multiplier per extra source.
    corroboration_bonus: float = 0.35
    # Don't repeat a topic published within this many days.
    cooldown_days: int = 30
    min_score: float = 0.05
    youtube_api_key: str = ""
    request_timeout: float = 15.0


@dataclass
class ScriptConfig:
    """How the narration is written."""

    writer: str = "auto"  # auto | anthropic | template
    model: str = "claude-opus-5"
    effort: str = "medium"
    target_seconds: float = 42.0
    words_per_second: float = 2.6
    max_beats: int = 6
    tone: str = "curious, fast-paced, plainspoken"
    audience: str = "a general short-form video audience"
    max_tokens: int = 4000


@dataclass
class VoiceConfig:
    """Text-to-speech backend selection."""

    backend: str = "auto"  # auto | elevenlabs | openai | espeak
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"
    elevenlabs_model: str = "eleven_multilingual_v2"
    openai_model: str = "gpt-4o-mini-tts"
    openai_voice: str = "alloy"
    espeak_voice: str = "en-us+f3"
    espeak_wpm: int = 165
    request_timeout: float = 120.0


@dataclass
class VisualsConfig:
    """Where background footage comes from."""

    provider: str = "auto"  # auto | pexels | gradient
    orientation: str = "portrait"
    per_beat_seconds: float = 0.0  # 0 => split the voiceover evenly across clips
    max_clips: int = 8
    gradient_palette: list[list[str]] = field(
        default_factory=lambda: [
            ["#12002e", "#5b0f8b"],
            ["#001f3f", "#0074d9"],
            ["#2d0b00", "#c1440e"],
            ["#00251a", "#04724d"],
            ["#1a1a2e", "#e94560"],
        ]
    )
    request_timeout: float = 60.0


@dataclass
class CaptionsConfig:
    """Burned-in caption styling and chunking."""

    enabled: bool = True
    max_chars: int = 28
    font: str = "DejaVu Sans"
    font_size: int = 78
    primary_colour: str = "&H00FFFFFF"
    outline_colour: str = "&H00000000"
    outline: int = 5
    shadow: int = 2
    margin_v: int = 420


@dataclass
class RenderConfig:
    """Output video encoding."""

    width: int = 1080
    height: int = 1920
    fps: int = 30
    video_codec: str = "libx264"
    preset: str = "medium"
    crf: int = 20
    audio_codec: str = "aac"
    audio_bitrate: str = "192k"
    music_path: str = ""
    music_volume: float = 0.12
    ffmpeg_bin: str = "ffmpeg"
    ffprobe_bin: str = "ffprobe"
    timeout: float = 900.0


@dataclass
class PublishConfig:
    """Which platforms to post to. Empty list means render only."""

    targets: list[str] = field(default_factory=list)  # youtube | tiktok | instagram
    privacy: str = "public"
    title_suffix: str = ""
    description_footer: str = ""
    hashtag_limit: int = 8
    # Instagram's Graph API pulls the file over HTTP, so it needs a public URL.
    public_base_url: str = ""
    request_timeout: float = 300.0


@dataclass
class Config:
    """Top-level pipeline configuration."""

    output_dir: str = "output"
    state_path: str = "output/state.json"
    workdir: str = ""
    blocklist_extra: list[str] = field(default_factory=list)
    discovery: DiscoveryConfig = field(default_factory=DiscoveryConfig)
    script: ScriptConfig = field(default_factory=ScriptConfig)
    voice: VoiceConfig = field(default_factory=VoiceConfig)
    visuals: VisualsConfig = field(default_factory=VisualsConfig)
    captions: CaptionsConfig = field(default_factory=CaptionsConfig)
    render: RenderConfig = field(default_factory=RenderConfig)
    publish: PublishConfig = field(default_factory=PublishConfig)


def expand_env(value: Any) -> Any:
    """Recursively replace ``${VAR}`` / ``${VAR:-default}`` with environment values."""
    if isinstance(value, str):
        return _ENV_REF.sub(lambda m: os.environ.get(m.group(1), m.group(2) or ""), value)
    if isinstance(value, list):
        return [expand_env(v) for v in value]
    if isinstance(value, dict):
        return {k: expand_env(v) for k, v in value.items()}
    return value


# ``from __future__ import annotations`` turns field types into strings, so the
# nested sections are mapped explicitly rather than introspected.
_SECTIONS: dict[str, type] = {
    "discovery": DiscoveryConfig,
    "script": ScriptConfig,
    "voice": VoiceConfig,
    "visuals": VisualsConfig,
    "captions": CaptionsConfig,
    "render": RenderConfig,
    "publish": PublishConfig,
}


def _build(cls: type, data: dict[str, Any], path: str = "") -> Any:
    """Instantiate a (possibly nested) config dataclass from a plain dict."""
    known = {f.name for f in fields(cls)}
    unknown = sorted(set(data) - known)
    if unknown:
        where = path or cls.__name__
        raise ConfigError(f"unknown config key(s) under {where}: {', '.join(unknown)}")

    kwargs: dict[str, Any] = {}
    for name, value in data.items():
        section = _SECTIONS.get(name) if cls is Config else None
        if section is not None:
            if not isinstance(value, dict):
                raise ConfigError(f"config section '{name}' must be a mapping")
            kwargs[name] = _build(section, value, name)
        else:
            kwargs[name] = value
    return cls(**kwargs)


def load_config(path: str | os.PathLike[str] | None = None) -> Config:
    """Load configuration from ``path``; fall back to built-in defaults when absent."""
    if path is None:
        return Config()

    file_path = Path(path)
    if not file_path.exists():
        raise ConfigError(f"config file not found: {file_path}")

    raw = file_path.read_text(encoding="utf-8")
    if file_path.suffix in {".yaml", ".yml"}:
        try:
            import yaml
        except ImportError as exc:  # pragma: no cover - depends on install
            raise ConfigError("PyYAML is required to read YAML config files") from exc
        data = yaml.safe_load(raw) or {}
    else:
        data = json.loads(raw or "{}")

    if not isinstance(data, dict):
        raise ConfigError(f"config root must be a mapping, got {type(data).__name__}")

    return _build(Config, expand_env(data))
