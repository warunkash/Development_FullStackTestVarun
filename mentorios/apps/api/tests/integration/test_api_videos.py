"""Integration tests for the video ingestion API."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from main import app


@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
def mock_db():
    with patch("core.database.get_db") as mock:
        db = AsyncMock()
        mock.return_value = db
        yield db


@pytest.mark.asyncio
class TestVideoIngestURL:
    async def test_ingest_youtube_url_accepted(self, client, mock_db):
        video_id = uuid.uuid4()
        mock_video = MagicMock()
        mock_video.id = video_id
        mock_video.title = "Bruce Lee Interview"
        mock_video.source = "youtube"
        mock_video.source_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        mock_video.status = "QUEUED"
        mock_video.duration_seconds = None
        mock_video.thumbnail_url = None
        mock_video.created_at.isoformat.return_value = "2026-01-01T00:00:00Z"

        with patch("services.video_service.VideoService.create_from_url", return_value=mock_video), \
             patch("services.video_service.VideoService.dispatch_processing", new_callable=AsyncMock):

            response = await client.post(
                "/api/v1/videos/ingest-url",
                json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
            )

        assert response.status_code == 202

    async def test_ingest_requires_url(self, client, mock_db):
        response = await client.post("/api/v1/videos/ingest-url", json={})
        assert response.status_code == 422

    async def test_list_videos_returns_list(self, client, mock_db):
        with patch("services.video_service.VideoService.list_videos", return_value=[]):
            response = await client.get("/api/v1/videos")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


@pytest.mark.asyncio
class TestVideoStatus:
    async def test_get_status_not_found(self, client, mock_db):
        video_id = uuid.uuid4()
        with patch("services.video_service.VideoService.get_processing_status", return_value=None):
            response = await client.get(f"/api/v1/videos/{video_id}/status")
        assert response.status_code == 404

    async def test_get_status_found(self, client, mock_db):
        video_id = uuid.uuid4()
        status_data = {
            "id": video_id,
            "status": "ANALYZING_VISION",
            "progress": 0.5,
            "current_step": "Detecting scenes",
            "error_message": None,
        }
        with patch("services.video_service.VideoService.get_processing_status", return_value=status_data):
            response = await client.get(f"/api/v1/videos/{video_id}/status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ANALYZING_VISION"
        assert data["progress"] == 0.5


@pytest.mark.asyncio
class TestHealthEndpoint:
    async def test_health_returns_ok(self, client):
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
