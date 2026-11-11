"""Upload to YouTube as a Short via the Data API v3 resumable endpoint.

A vertical video under three minutes is treated as a Short by YouTube
automatically; there is no separate Shorts endpoint to call.
"""

from __future__ import annotations

import json
import logging
import os

import requests

from ..errors import PublishError
from .base import PublishResult, Target, UploadRequest

logger = logging.getLogger(__name__)

TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"

_PRIVACY = {"public": "public", "private": "private", "unlisted": "unlisted"}


class YouTubeTarget(Target):
    """Publishes to the channel that issued the refresh token."""

    name = "youtube"
    required_env = ("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN")

    def access_token(self, timeout: float) -> str:
        """Exchange the long-lived refresh token for a short-lived access token."""
        response = requests.post(
            TOKEN_URL,
            timeout=timeout,
            data={
                "client_id": os.environ["YOUTUBE_CLIENT_ID"],
                "client_secret": os.environ["YOUTUBE_CLIENT_SECRET"],
                "refresh_token": os.environ["YOUTUBE_REFRESH_TOKEN"],
                "grant_type": "refresh_token",
            },
        )
        if response.status_code >= 400:
            raise PublishError(f"YouTube token refresh failed: {response.text[:300]}")
        token = response.json().get("access_token")
        if not token:
            raise PublishError("YouTube token refresh returned no access_token")
        return token

    def publish(self, request: UploadRequest, timeout: float) -> PublishResult:
        missing = self.missing_env()
        if missing:
            return PublishResult(self.name, False, detail=f"missing env: {', '.join(missing)}")

        try:
            token = self.access_token(timeout)
            size = request.video_path.stat().st_size
            metadata = {
                "snippet": {
                    # YouTube rejects titles over 100 characters outright.
                    "title": request.title[:100],
                    "description": request.description[:4900],
                    "tags": request.tags[:15],
                    "categoryId": "27",  # Education
                },
                "status": {
                    "privacyStatus": _PRIVACY.get(request.privacy, "private"),
                    "selfDeclaredMadeForKids": False,
                },
            }

            init = requests.post(
                UPLOAD_URL,
                timeout=timeout,
                params={"uploadType": "resumable", "part": "snippet,status"},
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json; charset=UTF-8",
                    "X-Upload-Content-Length": str(size),
                    "X-Upload-Content-Type": "video/mp4",
                },
                data=json.dumps(metadata),
            )
            if init.status_code >= 400:
                raise PublishError(f"upload init failed ({init.status_code}): {init.text[:300]}")
            session_url = init.headers.get("Location")
            if not session_url:
                raise PublishError("upload init returned no resumable session URL")

            with request.video_path.open("rb") as handle:
                upload = requests.put(
                    session_url,
                    timeout=timeout,
                    headers={"Content-Type": "video/mp4", "Content-Length": str(size)},
                    data=handle,
                )
            if upload.status_code >= 400:
                raise PublishError(f"upload failed ({upload.status_code}): {upload.text[:300]}")

            video_id = upload.json().get("id", "")
            return PublishResult(
                self.name, True, url=f"https://www.youtube.com/shorts/{video_id}" if video_id else ""
            )
        except (requests.RequestException, PublishError, ValueError, OSError) as exc:
            logger.error("youtube publish failed: %s", exc)
            return PublishResult(self.name, False, detail=str(exc))
