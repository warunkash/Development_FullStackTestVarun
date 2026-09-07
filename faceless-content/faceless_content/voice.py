"""Text-to-speech: turn narration into a voiceover track.

Three backends, tried in descending order of quality when ``backend: auto``.
espeak-ng is the local, key-free floor - it is robotic, but it keeps the
pipeline runnable and timings honest without a paid account.
"""

from __future__ import annotations

import logging
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

import requests

from .config import VoiceConfig
from .errors import VoiceError
from .ffmpeg import probe_duration, require

logger = logging.getLogger(__name__)


@dataclass
class VoiceOver:
    """A rendered narration track."""

    path: Path
    duration: float
    backend: str


class ElevenLabsBackend:
    """ElevenLabs text-to-speech. Requires ELEVENLABS_API_KEY."""

    name = "elevenlabs"
    extension = ".mp3"

    def available(self) -> bool:
        return bool(os.environ.get("ELEVENLABS_API_KEY"))

    def synthesize(self, text: str, out_path: Path, cfg: VoiceConfig) -> None:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{cfg.elevenlabs_voice_id}"
        response = requests.post(
            url,
            timeout=cfg.request_timeout,
            headers={
                "xi-api-key": os.environ["ELEVENLABS_API_KEY"],
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            json={
                "text": text,
                "model_id": cfg.elevenlabs_model,
                "voice_settings": {"stability": 0.4, "similarity_boost": 0.75},
            },
        )
        if response.status_code >= 400:
            raise VoiceError(f"ElevenLabs returned {response.status_code}: {response.text[:300]}")
        out_path.write_bytes(response.content)


class OpenAIBackend:
    """OpenAI text-to-speech. Requires OPENAI_API_KEY."""

    name = "openai"
    extension = ".mp3"

    def available(self) -> bool:
        return bool(os.environ.get("OPENAI_API_KEY"))

    def synthesize(self, text: str, out_path: Path, cfg: VoiceConfig) -> None:
        response = requests.post(
            "https://api.openai.com/v1/audio/speech",
            timeout=cfg.request_timeout,
            headers={
                "Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}",
                "Content-Type": "application/json",
            },
            json={
                "model": cfg.openai_model,
                "voice": cfg.openai_voice,
                "input": text,
                "response_format": "mp3",
            },
        )
        if response.status_code >= 400:
            raise VoiceError(f"OpenAI TTS returned {response.status_code}: {response.text[:300]}")
        out_path.write_bytes(response.content)


class EspeakBackend:
    """Offline fallback using espeak-ng."""

    name = "espeak"
    extension = ".wav"

    def available(self) -> bool:
        try:
            require("espeak-ng")
        except Exception:  # noqa: BLE001 - availability probe
            return False
        return True

    def synthesize(self, text: str, out_path: Path, cfg: VoiceConfig) -> None:
        cmd = [
            require("espeak-ng"),
            "-v", cfg.espeak_voice,
            "-s", str(cfg.espeak_wpm),
            "-w", str(out_path),
            text,
        ]
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=cfg.request_timeout, check=False
            )
        except subprocess.TimeoutExpired as exc:
            raise VoiceError("espeak-ng timed out") from exc
        if result.returncode != 0:
            raise VoiceError(f"espeak-ng failed: {result.stderr.strip()[:300]}")


BACKENDS = {b.name: b for b in (ElevenLabsBackend(), OpenAIBackend(), EspeakBackend())}
_AUTO_ORDER = ("elevenlabs", "openai", "espeak")


def select_backends(cfg: VoiceConfig) -> list:
    """Resolve the configured backend into an ordered list of candidates to try."""
    choice = (cfg.backend or "auto").lower()
    if choice == "auto":
        return [BACKENDS[name] for name in _AUTO_ORDER if BACKENDS[name].available()]
    backend = BACKENDS.get(choice)
    if backend is None:
        raise VoiceError(f"unknown voice backend {cfg.backend!r}")
    return [backend]


def synthesize(text: str, out_dir: Path, cfg: VoiceConfig, ffprobe_bin: str = "ffprobe") -> VoiceOver:
    """Render ``text`` to an audio file, trying each available backend in turn."""
    if not text.strip():
        raise VoiceError("nothing to narrate: the script produced empty text")

    candidates = select_backends(cfg)
    if not candidates:
        raise VoiceError(
            "no text-to-speech backend available. Set ELEVENLABS_API_KEY or OPENAI_API_KEY, "
            "or install espeak-ng for the offline fallback."
        )

    out_dir.mkdir(parents=True, exist_ok=True)
    errors = []
    for backend in candidates:
        out_path = out_dir / f"voiceover{backend.extension}"
        try:
            backend.synthesize(text, out_path, cfg)
            if not out_path.exists() or out_path.stat().st_size == 0:
                raise VoiceError(f"{backend.name} wrote an empty file")
            duration = probe_duration(out_path, ffprobe_bin)
            logger.info("voiceover: %s, %.1fs", backend.name, duration)
            return VoiceOver(path=out_path, duration=duration, backend=backend.name)
        except Exception as exc:  # noqa: BLE001 - fall through to the next backend
            logger.warning("voice backend %s failed: %s", backend.name, exc)
            errors.append(f"{backend.name}: {exc}")

    raise VoiceError("every text-to-speech backend failed -> " + "; ".join(errors))
