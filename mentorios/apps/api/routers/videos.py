import uuid
from datetime import datetime
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.video import ProcessingStatus, VideoSource
from services.video_service import VideoService

router = APIRouter(prefix="/videos", tags=["videos"])


class VideoIngestURL(BaseModel):
    url: str
    mentor_id: uuid.UUID | None = None
    title: str | None = None


class VideoResponse(BaseModel):
    id: uuid.UUID
    title: str | None
    source: VideoSource
    source_url: str | None
    status: ProcessingStatus
    duration_seconds: int | None
    thumbnail_url: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class VideoStatusResponse(BaseModel):
    id: uuid.UUID
    status: ProcessingStatus
    progress: float
    current_step: str | None
    error_message: str | None


@router.post(
    "/ingest-url", response_model=VideoResponse, status_code=status.HTTP_202_ACCEPTED
)
async def ingest_youtube_url(
    payload: VideoIngestURL,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> VideoResponse:
    """Ingest a YouTube URL or direct video URL for processing."""
    service = VideoService(db)
    video = await service.create_from_url(
        url=str(payload.url),
        mentor_id=payload.mentor_id,
        user_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),  # TODO: auth
    )
    background_tasks.add_task(service.dispatch_processing, video.id)
    return VideoResponse.model_validate(video)


@router.post(
    "/upload", response_model=VideoResponse, status_code=status.HTTP_202_ACCEPTED
)
async def upload_video(
    file: Annotated[UploadFile, File(description="Video file (MP4, MOV, AVI, MKV)")],
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> VideoResponse:
    """Upload a video file for processing."""
    if file.content_type not in [
        "video/mp4",
        "video/quicktime",
        "video/x-msvideo",
        "video/x-matroska",
    ]:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported media type: {file.content_type}",
        )

    service = VideoService(db)
    video = await service.create_from_upload(
        file=file,
        user_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),  # TODO: auth
    )
    background_tasks.add_task(service.dispatch_processing, video.id)
    return VideoResponse.model_validate(video)


@router.get("", response_model=list[VideoResponse])
async def list_videos(
    db: Annotated[AsyncSession, Depends(get_db)],
    status: ProcessingStatus | None = None,
    mentor_id: uuid.UUID | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[VideoResponse]:
    """List all videos with optional filtering."""
    service = VideoService(db)
    videos = await service.list_videos(
        status=status, mentor_id=mentor_id, limit=limit, offset=offset
    )
    return [VideoResponse.model_validate(v) for v in videos]


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> VideoResponse:
    """Get a specific video by ID."""
    service = VideoService(db)
    video = await service.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return VideoResponse.model_validate(video)


@router.get("/{video_id}/status", response_model=VideoStatusResponse)
async def get_video_status(
    video_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> VideoStatusResponse:
    """Get processing status for a video."""
    service = VideoService(db)
    status_data = await service.get_processing_status(video_id)
    if not status_data:
        raise HTTPException(status_code=404, detail="Video not found")
    return status_data  # type: ignore[return-value]


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(
    video_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a video and all associated data."""
    service = VideoService(db)
    deleted = await service.delete_video(video_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Video not found")
