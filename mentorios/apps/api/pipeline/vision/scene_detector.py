"""Scene segmentation using PySceneDetect + content-aware analysis."""

import logging
from dataclasses import dataclass, field
from pathlib import Path

log = logging.getLogger(__name__)


@dataclass
class SceneDetectionResult:
    scene_index: int
    start_time: float
    end_time: float
    start_frame: int
    end_frame: int
    keyframe_path: str | None = None
    metadata: dict = field(default_factory=dict)


def detect_scenes(
    video_path: Path,
    threshold: float = 30.0,
    min_scene_length_seconds: float = 1.0,
    keyframes_dir: Path | None = None,
) -> list[SceneDetectionResult]:
    """
    Detect scene boundaries in a video using adaptive content detection.

    Uses PySceneDetect with ContentDetector (motion + brightness changes).
    Threshold: 30.0 is good for most content; lower = more sensitive.
    """
    try:
        from scenedetect import SceneManager, open_video
        from scenedetect.detectors import AdaptiveDetector

        log.info("Detecting scenes in: %s (threshold=%.1f)", video_path.name, threshold)

        video = open_video(str(video_path))
        scene_manager = SceneManager()

        # AdaptiveDetector handles variable pacing better than ContentDetector alone
        scene_manager.add_detector(
            AdaptiveDetector(
                adaptive_threshold=threshold / 10,
                min_content_val=15.0,
                min_scene_len=int(min_scene_length_seconds * 30),  # assume ~30fps
            )
        )

        scene_manager.detect_scenes(video=video, show_progress=False)
        raw_scenes = scene_manager.get_scene_list()

        results = []
        for i, (start, end) in enumerate(raw_scenes):
            result = SceneDetectionResult(
                scene_index=i,
                start_time=start.get_seconds(),
                end_time=end.get_seconds(),
                start_frame=start.get_frames(),
                end_frame=end.get_frames(),
            )
            results.append(result)

        # Extract keyframes if output directory provided
        if keyframes_dir and results:
            _extract_keyframes(video_path, results, keyframes_dir)

        log.info("Detected %d scenes", len(results))
        return results

    except ImportError:
        log.warning("scenedetect not available, using FFmpeg scene detection")
        return _detect_scenes_ffmpeg(video_path, threshold, min_scene_length_seconds)


def _detect_scenes_ffmpeg(
    video_path: Path,
    threshold: float,
    min_scene_length_seconds: float,
) -> list[SceneDetectionResult]:
    """Fallback scene detection using FFmpeg scene filter."""
    import subprocess
    import re

    normalized_threshold = threshold / 100.0

    cmd = [
        "ffprobe",
        "-v",
        "quiet",
        "-show_frames",
        "-select_streams",
        "v",
        "-of",
        "csv=p=0",
        "-show_entries",
        "frame=pkt_pts_time,key_frame",
        "-vf",
        f"select=gt(scene\\,{normalized_threshold}),showinfo",
        str(video_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

    scene_times = [0.0]
    for line in result.stderr.split("\n"):
        match = re.search(r"pts_time:(\d+\.?\d*)", line)
        if match:
            t = float(match.group(1))
            if t - scene_times[-1] >= min_scene_length_seconds:
                scene_times.append(t)

    import subprocess as sp

    dur_result = sp.run(
        [
            "ffprobe",
            "-v",
            "quiet",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ],
        capture_output=True,
        text=True,
    )
    total_duration = float(dur_result.stdout.strip() or "0")
    scene_times.append(total_duration)

    scenes = []
    for i in range(len(scene_times) - 1):
        scenes.append(
            SceneDetectionResult(
                scene_index=i,
                start_time=scene_times[i],
                end_time=scene_times[i + 1],
                start_frame=0,
                end_frame=0,
            )
        )

    return scenes


def _extract_keyframes(
    video_path: Path,
    scenes: list[SceneDetectionResult],
    output_dir: Path,
) -> None:
    """Extract a representative keyframe from the middle of each scene."""
    import subprocess

    output_dir.mkdir(parents=True, exist_ok=True)

    for scene in scenes:
        midpoint = (scene.start_time + scene.end_time) / 2
        output_path = output_dir / f"scene_{scene.scene_index:04d}_keyframe.jpg"

        cmd = [
            "ffmpeg",
            "-ss",
            str(midpoint),
            "-i",
            str(video_path),
            "-vframes",
            "1",
            "-q:v",
            "2",
            "-y",
            str(output_path),
        ]

        result = subprocess.run(cmd, capture_output=True, timeout=30)
        if result.returncode == 0:
            scene.keyframe_path = str(output_path)
