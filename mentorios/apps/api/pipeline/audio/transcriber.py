"""Whisper-based transcription pipeline with word-level timestamps."""

import logging
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger(__name__)

_model_cache: dict = {}


@dataclass
class WordTimestamp:
    word: str
    start: float
    end: float
    probability: float


@dataclass
class TranscriptSegment:
    start: float
    end: float
    text: str
    words: list[WordTimestamp]
    confidence: float


@dataclass
class TranscriptionResult:
    language: str
    language_probability: float
    full_text: str
    segments: list[TranscriptSegment]
    word_count: int
    duration: float


def load_whisper_model(model_name: str = "large-v3-turbo", device: str = "cuda"):
    """Load Whisper model with caching."""
    cache_key = f"{model_name}:{device}"
    if cache_key not in _model_cache:
        log.info("Loading Whisper model: %s on %s", model_name, device)
        try:
            from faster_whisper import WhisperModel
            compute_type = "float16" if device == "cuda" else "int8"
            _model_cache[cache_key] = WhisperModel(
                model_name,
                device=device,
                compute_type=compute_type,
                num_workers=4,
            )
        except ImportError:
            import whisper
            _model_cache[cache_key] = whisper.load_model(model_name, device=device)
        log.info("Whisper model loaded")
    return _model_cache[cache_key]


def transcribe_audio(
    audio_path: Path,
    model_name: str = "large-v3-turbo",
    device: str = "cuda",
    language: str | None = None,
    initial_prompt: str | None = None,
) -> TranscriptionResult:
    """
    Transcribe audio file using Whisper with word-level timestamps.

    Uses faster-whisper for CTranslate2 acceleration (3-4x faster than OpenAI Whisper).
    """
    model = load_whisper_model(model_name, device)

    transcribe_kwargs = {
        "word_timestamps": True,
        "vad_filter": True,
        "vad_parameters": {"min_silence_duration_ms": 500},
        "beam_size": 5,
        "best_of": 5,
        "temperature": [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
    }

    if language:
        transcribe_kwargs["language"] = language
    if initial_prompt:
        transcribe_kwargs["initial_prompt"] = initial_prompt

    log.info("Transcribing: %s", audio_path.name)

    try:
        # faster-whisper interface
        segments_raw, info = model.transcribe(str(audio_path), **transcribe_kwargs)

        segments = []
        full_text_parts = []

        for seg in segments_raw:
            words = []
            if seg.words:
                words = [
                    WordTimestamp(
                        word=w.word,
                        start=w.start,
                        end=w.end,
                        probability=w.probability,
                    )
                    for w in seg.words
                ]

            avg_confidence = (
                sum(w.probability for w in words) / len(words) if words else 0.9
            )

            segments.append(
                TranscriptSegment(
                    start=seg.start,
                    end=seg.end,
                    text=seg.text.strip(),
                    words=words,
                    confidence=avg_confidence,
                )
            )
            full_text_parts.append(seg.text.strip())

        full_text = " ".join(full_text_parts)
        duration = info.duration if hasattr(info, "duration") else 0.0

        return TranscriptionResult(
            language=info.language,
            language_probability=info.language_probability,
            full_text=full_text,
            segments=segments,
            word_count=len(full_text.split()),
            duration=duration,
        )

    except AttributeError:
        # Fallback: OpenAI whisper interface
        result = model.transcribe(str(audio_path), word_timestamps=True, **{
            k: v for k, v in transcribe_kwargs.items()
            if k not in ("vad_filter", "vad_parameters")
        })

        segments = []
        for seg in result["segments"]:
            words = []
            if "words" in seg:
                words = [
                    WordTimestamp(
                        word=w["word"],
                        start=w["start"],
                        end=w["end"],
                        probability=w.get("probability", 0.9),
                    )
                    for w in seg["words"]
                ]

            segments.append(
                TranscriptSegment(
                    start=seg["start"],
                    end=seg["end"],
                    text=seg["text"].strip(),
                    words=words,
                    confidence=0.9,
                )
            )

        return TranscriptionResult(
            language=result.get("language", "en"),
            language_probability=1.0,
            full_text=result["text"].strip(),
            segments=segments,
            word_count=len(result["text"].split()),
            duration=segments[-1].end if segments else 0.0,
        )


def get_words_in_range(result: TranscriptionResult, start: float, end: float) -> list[WordTimestamp]:
    """Extract all words within a time range."""
    words = []
    for seg in result.segments:
        if seg.end < start:
            continue
        if seg.start > end:
            break
        for w in seg.words:
            if start <= w.start <= end:
                words.append(w)
    return words


def get_text_in_range(result: TranscriptionResult, start: float, end: float) -> str:
    """Get transcript text for a time range."""
    words = get_words_in_range(result, start, end)
    return " ".join(w.word for w in words).strip()
