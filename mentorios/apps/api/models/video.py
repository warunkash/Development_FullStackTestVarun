import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class VideoSource(str, enum.Enum):
    youtube = "youtube"
    upload = "upload"
    url = "url"


class ProcessingStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    DOWNLOADING = "DOWNLOADING"
    TRANSCRIBING = "TRANSCRIBING"
    ANALYZING_VISION = "ANALYZING_VISION"
    DETECTING_ACTIONS = "DETECTING_ACTIONS"
    GENERATING_WISDOM = "GENERATING_WISDOM"
    BUILDING_GRAPH = "BUILDING_GRAPH"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mentor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("mentors.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    source: Mapped[VideoSource] = mapped_column(Enum(VideoSource), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(2000))
    source_id: Mapped[str | None] = mapped_column(String(255))
    storage_path: Mapped[str | None] = mapped_column(String(1000))
    thumbnail_url: Mapped[str | None] = mapped_column(String(1000))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    fps: Mapped[float | None] = mapped_column(Float)
    language: Mapped[str] = mapped_column(String(10), default="en")
    status: Mapped[ProcessingStatus] = mapped_column(
        Enum(ProcessingStatus), nullable=False, default=ProcessingStatus.QUEUED
    )
    processing_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    processing_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    scenes: Mapped[list["Scene"]] = relationship("Scene", back_populates="video", lazy="dynamic")
    insights: Mapped[list["WisdomInsight"]] = relationship("WisdomInsight", back_populates="video", lazy="dynamic")


class Scene(Base):
    __tablename__ = "scenes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("videos.id"), nullable=False)
    scene_index: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)
    keyframe_path: Mapped[str | None] = mapped_column(String(1000))
    scene_type: Mapped[str | None] = mapped_column(String(100))
    environment: Mapped[str | None] = mapped_column(String(100))
    people_count: Mapped[int] = mapped_column(Integer, default=0)
    dominant_colors: Mapped[dict | None] = mapped_column(JSON)
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    video: Mapped["Video"] = relationship("Video", back_populates="scenes")


class WisdomInsight(Base):
    __tablename__ = "wisdom_insights"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("videos.id"), nullable=False)
    scene_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("scenes.id"))
    mentor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mentors.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    insight_text: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_quote: Mapped[str | None] = mapped_column(Text)
    start_time: Mapped[float | None] = mapped_column(Float)
    end_time: Mapped[float | None] = mapped_column(Float)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    model_version: Mapped[str | None] = mapped_column(String(100))
    graph_node_id: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    video: Mapped["Video"] = relationship("Video", back_populates="insights")
    applications: Mapped[list["InsightApplication"]] = relationship(
        "InsightApplication", back_populates="insight", cascade="all, delete-orphan"
    )


class InsightApplication(Base):
    __tablename__ = "insight_applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    insight_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("wisdom_insights.id"), nullable=False
    )
    domain: Mapped[str] = mapped_column(String(50), nullable=False)
    application_text: Mapped[str] = mapped_column(Text, nullable=False)
    example: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    insight: Mapped["WisdomInsight"] = relationship("WisdomInsight", back_populates="applications")
