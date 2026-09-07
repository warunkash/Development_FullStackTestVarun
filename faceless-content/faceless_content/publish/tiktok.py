"""Upload to TikTok via the Content Posting API (direct post, single chunk)."""

from __future__ import annotations

import logging
import os
import time

import requests

from ..errors import PublishError
from .base import PublishResult, Target, UploadRequest

logger = logging.getLogger(__name__)

INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/"
STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/"

_PRIVACY = {
    "public": "PUBLIC_TO_EVERYONE",
    "private": "SELF_ONLY",
    "unlisted": "MUTUAL_FOLLOW_FRIENDS",
}


class TikTokTarget(Target):
    """Publishes to the account that issued the access token."""

    name = "tiktok"
    required_env = ("TIKTOK_ACCESS_TOKEN",)

    def _poll(self, publish_id: str, headers: dict, timeout: float) -> str:
        """Wait for TikTok to finish processing; returns the terminal status."""
        deadline = time.monotonic() + min(timeout, 300.0)
        status = "PROCESSING"
        while time.monotonic() < deadline:
            response = requests.post(
                STATUS_URL, timeout=30, headers=headers, json={"publish_id": publish_id}
            )
            if response.status_code >= 400:
                raise PublishError(f"status check failed: {response.text[:300]}")
            status = ((response.json().get("data") or {}).get("status")) or status
            if status in {"PUBLISH_COMPLETE", "FAILED"}:
                return status
            time.sleep(5)
        return status

    def publish(self, request: UploadRequest, timeout: float) -> PublishResult:
        missing = self.missing_env()
        if missing:
            return PublishResult(self.name, False, detail=f"missing env: {', '.join(missing)}")

        try:
            token = os.environ["TIKTOK_ACCESS_TOKEN"]
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json; charset=UTF-8",
            }
            size = request.video_path.stat().st_size
            caption = f"{request.title} {request.hashtag_line()}".strip()

            init = requests.post(
                INIT_URL,
                timeout=timeout,
                headers=headers,
                json={
                    "post_info": {
                        "title": caption[:2200],
                        "privacy_level": _PRIVACY.get(request.privacy, "SELF_ONLY"),
                        "disable_duet": False,
                        "disable_comment": False,
                        "disable_stitch": False,
                    },
                    "source_info": {
                        "source": "FILE_UPLOAD",
                        "video_size": size,
                        # One chunk keeps the upload a single PUT; TikTok allows
                        # this for files up to 64 MB, which a Short always is.
                        "chunk_size": size,
                        "total_chunk_count": 1,
                    },
                },
            )
            if init.status_code >= 400:
                raise PublishError(f"init failed ({init.status_code}): {init.text[:300]}")

            data = init.json().get("data") or {}
            publish_id = data.get("publish_id")
            upload_url = data.get("upload_url")
            if not publish_id or not upload_url:
                raise PublishError(f"init returned no upload URL: {init.text[:300]}")

            payload = request.video_path.read_bytes()
            upload = requests.put(
                upload_url,
                timeout=timeout,
                headers={
                    "Content-Type": "video/mp4",
                    "Content-Length": str(size),
                    "Content-Range": f"bytes 0-{size - 1}/{size}",
                },
                data=payload,
            )
            if upload.status_code >= 400:
                raise PublishError(f"upload failed ({upload.status_code}): {upload.text[:300]}")

            status = self._poll(publish_id, headers, timeout)
            if status == "FAILED":
                return PublishResult(self.name, False, detail="TikTok reported FAILED")
            return PublishResult(self.name, True, url=f"publish_id:{publish_id}", detail=status)
        except (requests.RequestException, PublishError, ValueError, OSError) as exc:
            logger.error("tiktok publish failed: %s", exc)
            return PublishResult(self.name, False, detail=str(exc))
