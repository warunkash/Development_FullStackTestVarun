"""Video management service — CRUD and processing dispatch."""

import uuid

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from models.video import ProcessingStatus, Video, VideoSource

settings = get_settings()


class VideoService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_from_url(
        self,
        url: str,
        user_id: uuid.UUID,
        mentor_id: uuid.UUID | None = None,
        title: str | None = None,
    ) -> Video:
        """Create a video record from a URL (YouTube or direct)."""
        from pipeline.video.downloader import extract_youtube_id, is_youtube_url

        source = VideoSource.youtube if is_youtube_url(url) else VideoSource.url
        source_id = extract_youtube_id(url) if source == VideoSource.youtube else None

        video = Video(
            user_id=user_id,
            mentor_id=mentor_id,
            source=source,
            source_url=url,
            source_id=source_id,
            title=title,
            status=ProcessingStatus.QUEUED,
        )
        self.db.add(video)
        await self.db.flush()
        return video

    async def create_from_upload(
        self,
        file: UploadFile,
        user_id: uuid.UUID,
        mentor_id: uuid.UUID | None = None,
    ) -> Video:
        """Create a video record from a file upload."""
        upload_id = str(uuid.uuid4())
        storage_path = f"uploads/{upload_id}/{file.filename}"

        await self._upload_to_storage(file, storage_path)

        video = Video(
            user_id=user_id,
            mentor_id=mentor_id,
            source=VideoSource.upload,
            title=file.filename,
            storage_path=storage_path,
            status=ProcessingStatus.QUEUED,
        )
        self.db.add(video)
        await self.db.flush()
        return video

    async def dispatch_processing(self, video_id: uuid.UUID) -> None:
        """Dispatch video to Celery processing pipeline."""
        from workers.tasks import process_video_task

        process_video_task.delay(str(video_id))

    async def get_video(self, video_id: uuid.UUID) -> Video | None:
        return await self.db.get(Video, video_id)

    async def list_videos(
        self,
        status: ProcessingStatus | None = None,
        mentor_id: uuid.UUID | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Video]:
        query = (
            select(Video).order_by(Video.created_at.desc()).limit(limit).offset(offset)
        )

        if status:
            query = query.where(Video.status == status)
        if mentor_id:
            query = query.where(Video.mentor_id == mentor_id)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_processing_status(self, video_id: uuid.UUID) -> dict | None:
        video = await self.get_video(video_id)
        if not video:
            return None

        # Check Redis for real-time progress
        progress, step = await self._get_redis_progress(str(video_id))

        return {
            "id": video.id,
            "status": video.status,
            "progress": progress,
            "current_step": step,
            "error_message": video.error_message,
        }

    async def delete_video(self, video_id: uuid.UUID) -> bool:
        video = await self.get_video(video_id)
        if not video:
            return False
        await self.db.delete(video)
        return True

    async def _upload_to_storage(self, file: UploadFile, path: str) -> None:
        """Upload file to MinIO/S3."""
        import io
        import boto3
        from botocore.config import Config

        content = await file.read()

        s3 = boto3.client(
            "s3",
            endpoint_url=settings.storage_endpoint,
            aws_access_key_id=settings.storage_access_key,
            aws_secret_access_key=settings.storage_secret_key,
            config=Config(signature_version="s3v4"),
        )

        s3.upload_fileobj(
            io.BytesIO(content),
            settings.storage_bucket_videos,
            path,
            ExtraArgs={"ContentType": file.content_type or "video/mp4"},
        )

    async def _get_redis_progress(self, video_id: str) -> tuple[float, str | None]:
        """Get real-time processing progress from Redis."""
        try:
            import redis.asyncio as aioredis

            r = aioredis.from_url(str(settings.redis_url))
            progress = await r.get(f"mentorios:job:{video_id}:progress")
            step = await r.get(f"mentorios:job:{video_id}:step")
            await r.aclose()
            return (
                float(progress or 0),
                step.decode() if step else None,
            )
        except Exception:
            return 0.0, None
