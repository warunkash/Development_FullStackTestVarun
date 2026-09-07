"""Publish a Reel via the Instagram Graph API.

Instagram does not accept a file upload here: it fetches the video over HTTP
itself, so the rendered file must already be reachable at a public URL. Set
``publish.public_base_url`` to wherever the pipeline's output is served from.
"""

from __future__ import annotations

import logging
import os
import time
from urllib.parse import quote

import requests

from ..errors import PublishError
from .base import PublishResult, Target, UploadRequest

logger = logging.getLogger(__name__)

GRAPH = "https://graph.facebook.com/v21.0"


class InstagramTarget(Target):
    """Publishes a Reel to the connected Instagram professional account."""

    name = "instagram"
    required_env = ("INSTAGRAM_USER_ID", "INSTAGRAM_ACCESS_TOKEN")

    def __init__(self, public_base_url: str = "") -> None:
        self.public_base_url = public_base_url.rstrip("/")

    def _wait_ready(self, creation_id: str, token: str, timeout: float) -> str:
        """Poll the container until Instagram has finished ingesting the video."""
        deadline = time.monotonic() + min(timeout, 300.0)
        status = "IN_PROGRESS"
        while time.monotonic() < deadline:
            response = requests.get(
                f"{GRAPH}/{creation_id}",
                timeout=30,
                params={"fields": "status_code,status", "access_token": token},
            )
            if response.status_code >= 400:
                raise PublishError(f"container status failed: {response.text[:300]}")
            status = response.json().get("status_code", status)
            if status in {"FINISHED", "ERROR", "EXPIRED"}:
                return status
            time.sleep(5)
        return status

    def publish(self, request: UploadRequest, timeout: float) -> PublishResult:
        missing = self.missing_env()
        if missing:
            return PublishResult(self.name, False, detail=f"missing env: {', '.join(missing)}")
        if not self.public_base_url:
            return PublishResult(
                self.name,
                False,
                detail="publish.public_base_url is required: Instagram fetches the file over HTTP",
            )

        try:
            token = os.environ["INSTAGRAM_ACCESS_TOKEN"]
            user_id = os.environ["INSTAGRAM_USER_ID"]
            video_url = f"{self.public_base_url}/{quote(request.video_path.name)}"
            caption = f"{request.title}\n\n{request.description}\n\n{request.hashtag_line()}".strip()

            create = requests.post(
                f"{GRAPH}/{user_id}/media",
                timeout=timeout,
                params={
                    "media_type": "REELS",
                    "video_url": video_url,
                    "caption": caption[:2200],
                    "share_to_feed": "true",
                    "access_token": token,
                },
            )
            if create.status_code >= 400:
                raise PublishError(f"container create failed: {create.text[:300]}")
            creation_id = create.json().get("id")
            if not creation_id:
                raise PublishError("container create returned no id")

            status = self._wait_ready(creation_id, token, timeout)
            if status != "FINISHED":
                return PublishResult(
                    self.name, False, detail=f"container did not finish ingesting ({status})"
                )

            publish = requests.post(
                f"{GRAPH}/{user_id}/media_publish",
                timeout=timeout,
                params={"creation_id": creation_id, "access_token": token},
            )
            if publish.status_code >= 400:
                raise PublishError(f"publish failed: {publish.text[:300]}")

            media_id = publish.json().get("id", "")
            return PublishResult(self.name, True, url=f"https://www.instagram.com/reel/{media_id}")
        except (requests.RequestException, PublishError, ValueError, OSError) as exc:
            logger.error("instagram publish failed: %s", exc)
            return PublishResult(self.name, False, detail=str(exc))
