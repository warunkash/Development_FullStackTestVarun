"""Assemble the final vertical video with ffmpeg.

Two stages. Each background clip is first normalised into a segment of exactly
the duration its beat needs - same resolution, frame rate and timebase - so the
concat demuxer can join them without re-encoding decisions leaking between
clips. The second stage joins the segments, burns the captions, and mixes the
voiceover with optional background music.

Every ffmpeg invocation runs with the work directory as its cwd and refers to
files by bare name. Subtitle and concat paths are otherwise a well-known source
of quoting bugs, because ffmpeg parses ':' and ',' inside filter arguments.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

from .config import RenderConfig
from .errors import RenderError
from .ffmpeg import probe_duration, require, run
from .visuals import VisualClip

logger = logging.getLogger(__name__)

LOUDNORM = "loudnorm=I=-16:TP=-1.5:LRA=11"


@dataclass
class RenderResult:
    """A finished video."""

    path: Path
    duration: float
    segments: int


def build_segment_command(
    source: str, out_name: str, duration: float, cfg: RenderConfig
) -> list[str]:
    """ffmpeg argv that turns one background clip into an exact-length segment."""
    video_filter = (
        f"scale={cfg.width}:{cfg.height}:force_original_aspect_ratio=increase,"
        f"crop={cfg.width}:{cfg.height},setsar=1,fps={cfg.fps},format=yuv420p"
    )
    return [
        require(cfg.ffmpeg_bin),
        "-y", "-v", "error",
        # Loop the source so a clip shorter than its slot still fills it.
        "-stream_loop", "-1",
        "-i", source,
        "-t", f"{duration:.3f}",
        "-an",
        "-vf", video_filter,
        "-c:v", cfg.video_codec,
        "-preset", cfg.preset,
        "-crf", str(cfg.crf),
        "-video_track_timescale", "90000",
        out_name,
    ]


def build_assemble_command(
    concat_name: str,
    voice_name: str,
    out_name: str,
    cfg: RenderConfig,
    subtitles_name: str | None = None,
    music_name: str | None = None,
) -> list[str]:
    """ffmpeg argv that joins segments, burns captions and mixes audio."""
    cmd = [
        require(cfg.ffmpeg_bin),
        "-y", "-v", "error",
        "-f", "concat", "-safe", "0", "-i", concat_name,
        "-i", voice_name,
    ]
    if music_name:
        # Loop the bed so a short music file still covers the whole video.
        cmd += ["-stream_loop", "-1", "-i", music_name]

    filters = []
    if subtitles_name:
        filters.append(f"[0:v]subtitles={subtitles_name}[v]")
    if music_name:
        filters.append(f"[1:a]{LOUDNORM}[speech]")
        filters.append(f"[2:a]volume={cfg.music_volume}[bed]")
        filters.append("[speech][bed]amix=inputs=2:duration=first:normalize=0[a]")
    else:
        filters.append(f"[1:a]{LOUDNORM}[a]")

    cmd += ["-filter_complex", ";".join(filters)]
    cmd += ["-map", "[v]" if subtitles_name else "0:v"]
    cmd += ["-map", "[a]"]

    if subtitles_name:
        cmd += ["-c:v", cfg.video_codec, "-preset", cfg.preset, "-crf", str(cfg.crf)]
    else:
        # Nothing touches the video stream, so keep the segments as encoded.
        cmd += ["-c:v", "copy"]

    cmd += [
        "-pix_fmt", "yuv420p",
        "-c:a", cfg.audio_codec,
        "-b:a", cfg.audio_bitrate,
        "-movflags", "+faststart",
        "-shortest",
        out_name,
    ]
    return cmd


def _stage(path: Path, workdir: Path, name: str) -> str:
    """Copy an input into the work directory so ffmpeg only sees bare filenames."""
    source = Path(path)
    if not source.exists():
        raise RenderError(f"missing input for render: {source}")
    target = workdir / name
    if source.resolve() != target.resolve():
        target.write_bytes(source.read_bytes())
    return name


def render(
    clips: list[tuple[VisualClip, float]],
    voice_path: Path,
    out_path: Path,
    cfg: RenderConfig,
    subtitles_path: Path | None = None,
    workdir: Path | None = None,
) -> RenderResult:
    """Render the finished video and return its path and measured duration."""
    if not clips:
        raise RenderError("no visual clips to render")

    out_path = Path(out_path)
    workdir = Path(workdir or out_path.parent / "work")
    workdir.mkdir(parents=True, exist_ok=True)

    segment_names: list[str] = []
    for index, (clip, duration) in enumerate(clips):
        if duration <= 0:
            logger.warning("skipping clip %d: non-positive duration", index)
            continue
        source_name = _stage(clip.path, workdir, f"src{index:02d}{clip.path.suffix or '.mp4'}")
        segment_name = f"seg{index:02d}.mp4"
        run(
            build_segment_command(source_name, segment_name, duration, cfg),
            cfg.timeout,
            what=f"segment {index}",
            cwd=workdir,
        )
        segment_names.append(segment_name)

    if not segment_names:
        raise RenderError("every clip had a non-positive duration")

    concat_name = "segments.txt"
    (workdir / concat_name).write_text(
        "".join(f"file '{name}'\n" for name in segment_names), encoding="utf-8"
    )

    voice_name = _stage(voice_path, workdir, f"voice{Path(voice_path).suffix or '.wav'}")
    subtitles_name = (
        _stage(subtitles_path, workdir, "captions.ass") if subtitles_path is not None else None
    )
    music_name = None
    if cfg.music_path:
        music = Path(cfg.music_path)
        if music.exists():
            music_name = _stage(music, workdir, f"music{music.suffix or '.mp3'}")
        else:
            logger.warning("music_path %s does not exist; rendering without a bed", music)

    out_name = "final.mp4"
    run(
        build_assemble_command(concat_name, voice_name, out_name, cfg, subtitles_name, music_name),
        cfg.timeout,
        what="assemble",
        cwd=workdir,
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    rendered = workdir / out_name
    out_path.write_bytes(rendered.read_bytes())
    duration = probe_duration(out_path, cfg.ffprobe_bin)
    logger.info("rendered %s (%.1fs, %d segments)", out_path, duration, len(segment_names))
    return RenderResult(path=out_path, duration=duration, segments=len(segment_names))
