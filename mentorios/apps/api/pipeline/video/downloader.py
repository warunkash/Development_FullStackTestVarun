"""Video download pipeline — supports YouTube URLs and direct video links."""

import asyncio
import logging
import re
import tempfile
from pathlib import Path

import yt_dlp

log = logging.getLogger(__name__)

YOUTUBE_PATTERN = re.compile(
    r"(?:https?://)?(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})"
)


def is_youtube_url(url: str) -> bool:
    return bool(YOUTUBE_PATTERN.search(url))


def extract_youtube_id(url: str) -> str | None:
    match = YOUTUBE_PATTERN.search(url)
    return match.group(1) if match else None


async def download_video(url: str, output_dir: Path, max_duration: int = 14400) -> dict:
    """
    Download a video from YouTube or direct URL.

    Returns metadata dict with path, title, duration, etc.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    output_template = str(output_dir / "%(id)s.%(ext)s")

    ydl_opts = {
        "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
        "outtmpl": output_template,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "match_filter": _check_duration(max_duration),
        "writeinfojson": False,
        "writethumbnail": True,
        "merge_output_format": "mp4",
        "postprocessors": [{"key": "FFmpegVideoConvertor", "preferedformat": "mp4"}],
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
    }

    loop = asyncio.get_event_loop()

    def _download():
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            return {
                "id": info.get("id"),
                "title": info.get("title"),
                "description": info.get("description"),
                "duration": info.get("duration"),
                "uploader": info.get("uploader"),
                "upload_date": info.get("upload_date"),
                "thumbnail": info.get("thumbnail"),
                "width": info.get("width"),
                "height": info.get("height"),
                "fps": info.get("fps"),
                "filepath": ydl.prepare_filename(info).replace(".webm", ".mp4").replace(".mkv", ".mp4"),
            }

    try:
        return await loop.run_in_executor(None, _download)
    except yt_dlp.utils.DownloadError as e:
        raise RuntimeError(f"Download failed: {e}") from e


def _check_duration(max_seconds: int):
    def check(info, *, incomplete):
        duration = info.get("duration")
        if duration and duration > max_seconds:
            return f"Video too long: {duration}s > {max_seconds}s limit"
        return None
    return check


async def extract_audio(video_path: Path, output_path: Path) -> Path:
    """Extract audio track from video using FFmpeg."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg", "-i", str(video_path),
        "-vn",                          # No video
        "-acodec", "pcm_s16le",         # WAV format for Whisper
        "-ar", "16000",                 # 16kHz sample rate
        "-ac", "1",                     # Mono
        "-y",                           # Overwrite
        str(output_path),
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise RuntimeError(f"Audio extraction failed: {stderr.decode()}")

    return output_path


async def extract_frames(
    video_path: Path,
    output_dir: Path,
    fps: float = 1.0,
    quality: int = 2,
) -> list[Path]:
    """Extract frames from video at specified FPS using FFmpeg."""
    output_dir.mkdir(parents=True, exist_ok=True)
    output_pattern = str(output_dir / "frame_%06d.jpg")

    cmd = [
        "ffmpeg", "-i", str(video_path),
        "-vf", f"fps={fps}",
        "-q:v", str(quality),           # Quality 1-31, lower = better
        "-y",
        output_pattern,
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise RuntimeError(f"Frame extraction failed: {stderr.decode()}")

    frames = sorted(output_dir.glob("frame_*.jpg"))
    log.info("Extracted %d frames from %s", len(frames), video_path.name)
    return frames


async def get_video_metadata(video_path: Path) -> dict:
    """Get video metadata using ffprobe."""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_streams", "-show_format",
        str(video_path),
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()

    if proc.returncode != 0:
        raise RuntimeError("ffprobe failed")

    import json
    data = json.loads(stdout)

    video_stream = next(
        (s for s in data.get("streams", []) if s.get("codec_type") == "video"),
        {}
    )
    fmt = data.get("format", {})

    return {
        "duration": float(fmt.get("duration", 0)),
        "size_bytes": int(fmt.get("size", 0)),
        "width": video_stream.get("width"),
        "height": video_stream.get("height"),
        "fps": eval(video_stream.get("r_frame_rate", "0/1")),  # noqa: S307
        "codec": video_stream.get("codec_name"),
        "bit_rate": int(fmt.get("bit_rate", 0)),
    }
