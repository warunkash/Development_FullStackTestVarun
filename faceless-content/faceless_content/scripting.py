"""Turn a discovered topic into a narrated short-form script.

The Anthropic writer is the default. A template writer covers the no-API-key
case so the pipeline stays runnable end to end (CI, first-run smoke tests)
without silently producing an empty video.
"""

from __future__ import annotations

import json
import logging
import os
import re
import textwrap
from dataclasses import dataclass, field

from .config import ScriptConfig
from .errors import ScriptError

logger = logging.getLogger(__name__)

_SENTENCE = re.compile(r"(?<=[.!?])\s+")

SCRIPT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "hook": {"type": "string"},
        "beats": {"type": "array", "items": {"type": "string"}},
        "cta": {"type": "string"},
        "hashtags": {"type": "array", "items": {"type": "string"}},
        "visual_queries": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["title", "hook", "beats", "cta", "hashtags", "visual_queries"],
    "additionalProperties": False,
}

SYSTEM_PROMPT = """\
You write narration for faceless short-form vertical videos (YouTube Shorts, \
TikTok, Reels). The narration is read aloud by a synthetic voice over stock \
footage; nobody appears on camera, so the words carry the whole video.

Rules:
- The hook is one sentence and must earn the next three seconds. No "in this \
video" and no greeting.
- Each beat is one or two spoken sentences that advance a single idea. Beats \
must be concrete and specific; a beat that could be about any topic is wrong.
- Write for the ear: short clauses, active voice, no bullet syntax, no emoji, \
no stage directions, no numbered lists read aloud.
- Never state a fact you are not confident is true. Prefer what is well \
established about the topic over what is merely current.
- The CTA is one short line, and never begs for engagement.
- visual_queries are stock-footage search phrases, one per beat, describing a \
filmable scene (not an abstract concept).
- hashtags omit the leading '#'.
"""


@dataclass
class VideoScript:
    """A complete short-form script."""

    topic: str
    title: str
    hook: str
    beats: list[str] = field(default_factory=list)
    cta: str = ""
    hashtags: list[str] = field(default_factory=list)
    visual_queries: list[str] = field(default_factory=list)
    writer: str = ""

    def narration(self) -> str:
        """The full spoken text, in order."""
        parts = [self.hook, *self.beats]
        if self.cta:
            parts.append(self.cta)
        return " ".join(p.strip() for p in parts if p and p.strip())

    def word_count(self) -> int:
        return len(self.narration().split())

    def estimated_seconds(self, words_per_second: float) -> float:
        return self.word_count() / max(0.5, words_per_second)


def word_budget(cfg: ScriptConfig) -> int:
    """How many spoken words fit the target duration."""
    return max(30, int(cfg.target_seconds * cfg.words_per_second))


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("—", " - ")).strip()


def _coerce(payload: dict, topic: str, cfg: ScriptConfig, writer: str) -> VideoScript:
    """Validate and tidy a raw script payload into a VideoScript."""
    hook = _clean(payload.get("hook", ""))
    beats = [_clean(b) for b in payload.get("beats", []) if _clean(b)][: cfg.max_beats]
    if not hook or not beats:
        raise ScriptError("script writer returned no hook or no beats")

    hashtags = [
        re.sub(r"[^0-9A-Za-z]", "", tag).lower()
        for tag in payload.get("hashtags", [])
        if re.sub(r"[^0-9A-Za-z]", "", tag)
    ]
    queries = [_clean(q) for q in payload.get("visual_queries", []) if _clean(q)]
    return VideoScript(
        topic=topic,
        title=_clean(payload.get("title", "")) or topic,
        hook=hook,
        beats=beats,
        cta=_clean(payload.get("cta", "")),
        hashtags=hashtags,
        visual_queries=queries or [topic],
        writer=writer,
    )


class TemplateScriptWriter:
    """Deterministic fallback writer: reshapes the source summary into beats.

    It produces a genuinely watchable script only when the topic came with a
    summary. It exists so the pipeline never hard-fails on a missing API key,
    not as a replacement for the model writer.
    """

    name = "template"

    def write(self, topic: str, summary: str, cfg: ScriptConfig) -> VideoScript:
        budget = word_budget(cfg)
        sentences = [s.strip() for s in _SENTENCE.split(_clean(summary)) if len(s.split()) > 3]

        hook = f"Here is what most people get wrong about {topic}."
        beats: list[str] = []
        spent = len(hook.split())
        for sentence in sentences:
            if len(beats) >= cfg.max_beats or spent >= budget:
                break
            beats.append(sentence)
            spent += len(sentence.split())

        if not beats:
            beats = [
                f"{topic} is one of the most looked-up subjects on the internet right now.",
                f"The short version: {topic} keeps showing up because it touches something "
                "people already care about, and it rewards about sixty seconds of attention.",
                "Look it up once and you start seeing it everywhere.",
            ]

        return _coerce(
            {
                "title": topic,
                "hook": hook,
                "beats": beats,
                "cta": "Follow for one of these a day.",
                "hashtags": ["shorts", "facts", "learnontiktok"],
                "visual_queries": [topic] * len(beats),
            },
            topic,
            cfg,
            self.name,
        )


class AnthropicScriptWriter:
    """Script writer backed by the Claude Messages API."""

    name = "anthropic"

    def __init__(self, api_key: str | None = None, client=None) -> None:
        self._client = client
        self._api_key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")

    def _get_client(self):
        if self._client is not None:
            return self._client
        try:
            import anthropic
        except ImportError as exc:  # pragma: no cover - depends on install
            raise ScriptError("the 'anthropic' package is required for the model writer") from exc
        self._client = (
            anthropic.Anthropic(api_key=self._api_key) if self._api_key else anthropic.Anthropic()
        )
        return self._client

    def write(self, topic: str, summary: str, cfg: ScriptConfig) -> VideoScript:
        budget = word_budget(cfg)
        prompt = textwrap.dedent(
            f"""\
            Topic: {topic}

            What we know about it (may be empty or partial):
            {summary or "(no summary available - rely on what you know about the topic)"}

            Write the narration for a {cfg.target_seconds:.0f}-second vertical video.
            Total spoken words across hook, beats and CTA: {budget} or fewer.
            At most {cfg.max_beats} beats.
            Tone: {cfg.tone}.
            Audience: {cfg.audience}.
            """
        )

        response = self._get_client().messages.create(
            model=cfg.model,
            max_tokens=cfg.max_tokens,
            system=SYSTEM_PROMPT,
            thinking={"type": "adaptive"},
            output_config={
                "effort": cfg.effort,
                "format": {"type": "json_schema", "schema": SCRIPT_SCHEMA},
            },
            messages=[{"role": "user", "content": prompt}],
        )

        if getattr(response, "stop_reason", None) == "refusal":
            details = getattr(response, "stop_details", None)
            raise ScriptError(f"model declined this topic ({getattr(details, 'category', 'unknown')})")

        text = next((b.text for b in response.content if b.type == "text"), "")
        if not text:
            raise ScriptError("model returned no text block")
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ScriptError(f"model returned invalid JSON: {exc}") from exc

        return _coerce(payload, topic, cfg, self.name)


def get_writer(cfg: ScriptConfig, api_key: str | None = None):
    """Pick a writer per config, falling back to the template writer when unusable."""
    choice = (cfg.writer or "auto").lower()
    key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")

    if choice == "template":
        return TemplateScriptWriter()
    if choice == "anthropic":
        return AnthropicScriptWriter(api_key=key)
    if choice != "auto":
        raise ScriptError(f"unknown script writer {cfg.writer!r}")

    if key:
        return AnthropicScriptWriter(api_key=key)
    logger.warning("ANTHROPIC_API_KEY not set - falling back to the template script writer")
    return TemplateScriptWriter()


def write_script(topic: str, summary: str, cfg: ScriptConfig, writer=None) -> VideoScript:
    """Write a script, degrading to the template writer if the model writer fails."""
    writer = writer or get_writer(cfg)
    try:
        return writer.write(topic, summary, cfg)
    except ScriptError:
        raise
    except Exception as exc:  # noqa: BLE001 - any API failure should still yield a video
        logger.warning("script writer %s failed (%s); using the template writer", writer.name, exc)
        return TemplateScriptWriter().write(topic, summary, cfg)
