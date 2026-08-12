from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "MentorOS API"
    app_version: str = "1.0.0"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    api_prefix: str = "/api/v1"
    allowed_origins: list[str] = Field(default=["http://localhost:3000"])

    # Security
    secret_key: str = Field(..., min_length=32)
    jwt_algorithm: str = "RS256"
    jwt_private_key: str = ""
    jwt_public_key: str = ""
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    # PostgreSQL
    database_url: str = Field(
        default="postgresql+asyncpg://mentorios:password@localhost:5432/mentorios"
    )
    database_pool_size: int = 20
    database_max_overflow: int = 40

    # Redis
    redis_url: str = Field(default="redis://localhost:6379/0")
    redis_cache_ttl: int = 3600

    # Neo4j
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "password"

    # Object Storage (MinIO / S3)
    storage_endpoint: str = "http://localhost:9000"
    storage_access_key: str = "minioadmin"
    storage_secret_key: str = "minioadmin"
    storage_bucket_videos: str = "mentorios-videos"
    storage_bucket_frames: str = "mentorios-frames"
    storage_bucket_audio: str = "mentorios-audio"

    # AI Models
    whisper_model: str = "large-v3-turbo"
    embedding_model: str = "BAAI/bge-m3"
    llm_model: str = "Qwen/Qwen2.5-72B-Instruct"
    video_llm_model: str = "Qwen/Qwen2.5-VL-72B-Instruct"
    yolo_model: str = "yolo11x-pose.pt"
    device: str = "cuda"  # "cpu" | "cuda" | "mps"

    # vLLM
    vllm_base_url: str = "http://localhost:8100"
    vllm_api_key: str = "mentorios-local"

    # Processing
    max_video_duration_seconds: int = 14400  # 4 hours
    max_upload_size_mb: int = 5000
    frame_extraction_fps: float = 1.0
    scene_threshold: float = 30.0

    # Rate Limiting
    rate_limit_requests_per_minute: int = 100
    rate_limit_chat_per_minute: int = 20

    # Celery
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # Monitoring
    sentry_dsn: str = ""
    prometheus_enabled: bool = True
    otel_endpoint: str = "http://localhost:4317"

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, v: str | list) -> list:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
