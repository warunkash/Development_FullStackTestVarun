"""Publishing targets and the dispatcher that runs them."""

from __future__ import annotations

import logging

from ..config import PublishConfig
from .base import PublishResult, Target, UploadRequest
from .instagram import InstagramTarget
from .tiktok import TikTokTarget
from .youtube import YouTubeTarget

logger = logging.getLogger(__name__)

__all__ = [
    "InstagramTarget",
    "PublishResult",
    "Target",
    "TikTokTarget",
    "UploadRequest",
    "YouTubeTarget",
    "build_targets",
    "publish_all",
]


def build_targets(cfg: PublishConfig) -> list[Target]:
    """Instantiate the configured targets, skipping unknown names."""
    targets: list[Target] = []
    for name in cfg.targets:
        key = name.strip().lower()
        if key == "youtube":
            targets.append(YouTubeTarget())
        elif key == "tiktok":
            targets.append(TikTokTarget())
        elif key == "instagram":
            targets.append(InstagramTarget(cfg.public_base_url))
        else:
            logger.warning("unknown publish target %r, skipping", name)
    return targets


def publish_all(
    request: UploadRequest, cfg: PublishConfig, dry_run: bool = False
) -> list[PublishResult]:
    """Publish to every configured target. One failure never blocks the others."""
    targets = build_targets(cfg)
    if not targets:
        logger.info("no publish targets configured; render-only run")
        return []

    results = []
    for target in targets:
        if dry_run:
            missing = target.missing_env()
            detail = "dry run" + (f" (would fail: missing {', '.join(missing)})" if missing else "")
            results.append(PublishResult(target.name, True, detail=detail))
            continue
        logger.info("publishing to %s", target.name)
        results.append(target.publish(request, cfg.request_timeout))
    return results
