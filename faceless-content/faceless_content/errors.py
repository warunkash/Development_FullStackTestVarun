"""Exception types shared across the pipeline stages."""

from __future__ import annotations


class PipelineError(Exception):
    """Base class for every failure the pipeline raises deliberately."""


class ConfigError(PipelineError):
    """Configuration is missing or malformed."""


class DiscoveryError(PipelineError):
    """No usable topic could be discovered."""


class ScriptError(PipelineError):
    """The script writer produced nothing usable."""


class VoiceError(PipelineError):
    """Text-to-speech failed for every configured backend."""


class VisualsError(PipelineError):
    """No visual could be acquired or generated."""


class RenderError(PipelineError):
    """ffmpeg failed to assemble the video."""


class PublishError(PipelineError):
    """A publishing target rejected the upload."""
