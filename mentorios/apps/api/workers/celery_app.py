"""Celery application configuration."""

from celery import Celery

from core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "mentorios",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,  # One task at a time (GPU-bound)
    task_routes={
        "workers.tasks.process_video_task": {"queue": "video"},
        "workers.tasks.generate_wisdom_task": {"queue": "wisdom"},
        "workers.tasks.generate_embeddings_task": {"queue": "embed"},
    },
    beat_schedule={
        "cleanup-failed-jobs": {
            "task": "workers.tasks.cleanup_failed_jobs",
            "schedule": 3600.0,  # Every hour
        },
    },
)
