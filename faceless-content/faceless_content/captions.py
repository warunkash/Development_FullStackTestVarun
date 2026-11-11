"""Burned-in captions: chunk the narration and time it against the voiceover.

Without a forced aligner there is no per-word truth, so cues are timed by
weight: longer text takes proportionally longer to say. Across a 40-second
read that tracks the voice closely enough to stay in sync, and it costs no
extra dependency or API call.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from .config import CaptionsConfig

_WHITESPACE = re.compile(r"\s+")
# Speech pauses at punctuation, so a clause boundary is worth extra time.
_PAUSE_WEIGHT = {".": 4.0, "!": 4.0, "?": 4.0, ",": 2.0, ";": 2.5, ":": 2.5}


@dataclass(frozen=True)
class Cue:
    """One on-screen caption line."""

    start: float
    end: float
    text: str

    @property
    def duration(self) -> float:
        return self.end - self.start


def chunk(text: str, max_chars: int) -> list[str]:
    """Split narration into caption-sized lines, never breaking a word."""
    words = _WHITESPACE.sub(" ", text).strip().split(" ")
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        candidate = " ".join([*current, word])
        if current and len(candidate) > max_chars:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
        # A sentence end is a natural cut even when the line is short.
        if current and current[-1][-1:] in ".!?" and len(" ".join(current)) > max_chars * 0.5:
            lines.append(" ".join(current))
            current = []
    if current:
        lines.append(" ".join(current))
    return [line for line in lines if line]


def _weight(line: str) -> float:
    """Approximate how long a line takes to say."""
    return len(line) + sum(_PAUSE_WEIGHT.get(ch, 0.0) for ch in line)


def build_cues(text: str, total_duration: float, cfg: CaptionsConfig) -> list[Cue]:
    """Distribute ``total_duration`` across caption lines by spoken weight."""
    lines = chunk(text, cfg.max_chars)
    if not lines or total_duration <= 0:
        return []

    weights = [_weight(line) for line in lines]
    total_weight = sum(weights) or float(len(lines))

    cues: list[Cue] = []
    elapsed = 0.0
    for index, (line, weight) in enumerate(zip(lines, weights)):
        span = total_duration * (weight / total_weight)
        start = elapsed
        # Absorb float drift into the final cue so captions end with the audio.
        end = total_duration if index == len(lines) - 1 else start + span
        cues.append(Cue(start=round(start, 3), end=round(end, 3), text=line))
        elapsed = end
    return cues


def format_timestamp(seconds: float) -> str:
    """Format seconds as the ``H:MM:SS.cc`` timestamp ASS expects."""
    seconds = max(0.0, seconds)
    hours, remainder = divmod(int(seconds), 3600)
    minutes, secs = divmod(remainder, 60)
    centiseconds = int(round((seconds - int(seconds)) * 100))
    if centiseconds == 100:  # rounding can carry into the next second
        centiseconds = 0
        secs += 1
        if secs == 60:
            secs = 0
            minutes += 1
    return f"{hours}:{minutes:02d}:{secs:02d}.{centiseconds:02d}"


def escape_ass(text: str) -> str:
    """Escape the characters ASS treats as markup."""
    return (
        text.replace("\\", "\\\\")
        .replace("{", "\\{")
        .replace("}", "\\}")
        .replace("\n", "\\N")
    )


def to_ass(cues: list[Cue], cfg: CaptionsConfig, width: int, height: int) -> str:
    """Render cues as an ASS subtitle file body."""
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,{cfg.font},{cfg.font_size},{cfg.primary_colour},&H000000FF,{cfg.outline_colour},&H80000000,-1,0,0,0,100,100,0,0,1,{cfg.outline},{cfg.shadow},2,90,90,{cfg.margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = [
        "Dialogue: 0,{start},{end},Caption,,0,0,0,,{text}".format(
            start=format_timestamp(cue.start),
            end=format_timestamp(cue.end),
            text=escape_ass(cue.text),
        )
        for cue in cues
    ]
    return header + "\n".join(lines) + "\n"


def write_ass(cues: list[Cue], path: Path, cfg: CaptionsConfig, width: int, height: int) -> Path:
    """Write the subtitle file and return its path."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(to_ass(cues, cfg, width, height), encoding="utf-8")
    return path
