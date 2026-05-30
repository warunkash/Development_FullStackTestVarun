"""
MentorOS Celery Tasks — Complete AI processing pipeline.

Pipeline:
  download → extract_audio → transcribe → detect_scenes →
  analyze_poses → detect_actions → extract_wisdom →
  generate_embeddings → build_graph → complete
"""

import asyncio
import logging
import uuid
from pathlib import Path
from typing import Any

import redis
from celery import Task

from core.config import get_settings
from workers.celery_app import celery_app

log = logging.getLogger(__name__)
settings = get_settings()

redis_client = redis.from_url(str(settings.redis_url))


def _update_progress(video_id: str, progress: float, step: str) -> None:
    """Update real-time processing progress in Redis."""
    redis_client.set(f"mentorios:job:{video_id}:progress", str(progress), ex=3600)
    redis_client.set(f"mentorios:job:{video_id}:step", step, ex=3600)
    redis_client.publish(f"mentorios:video:{video_id}:status", f"{progress}:{step}")
    log.info("[%s] Progress: %.0f%% — %s", video_id[:8], progress * 100, step)


def _get_db_session():
    """Get synchronous database session for Celery tasks."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    sync_url = str(settings.database_url).replace("+asyncpg", "")
    engine = create_engine(sync_url, pool_size=5)
    Session = sessionmaker(bind=engine)
    return Session()


@celery_app.task(
    bind=True,
    name="workers.tasks.process_video_task",
    max_retries=3,
    default_retry_delay=60,
    queue="video",
)
def process_video_task(self: Task, video_id: str) -> dict[str, Any]:
    """
    Orchestrates the complete video processing pipeline.
    Runs synchronously in Celery worker.
    """
    db = _get_db_session()

    try:
        from models.video import ProcessingStatus, Video
        video = db.get(Video, uuid.UUID(video_id))

        if not video:
            raise ValueError(f"Video {video_id} not found")

        video.status = ProcessingStatus.DOWNLOADING
        db.commit()

        work_dir = Path(f"/tmp/mentorios/{video_id}")
        work_dir.mkdir(parents=True, exist_ok=True)

        # ── Step 1: Download / prepare video ──────────────────────────────
        _update_progress(video_id, 0.05, "Downloading video")
        video_path = _download_video(video, work_dir)

        video.status = ProcessingStatus.TRANSCRIBING
        db.commit()

        # ── Step 2: Extract audio and transcribe ──────────────────────────
        _update_progress(video_id, 0.15, "Extracting audio")
        audio_path = work_dir / "audio.wav"
        _run_async(asyncio.coroutine(_extract_audio_sync)(video_path, audio_path))

        _update_progress(video_id, 0.20, "Transcribing speech")
        transcript = _transcribe(audio_path)

        # Save transcript
        _save_transcript(db, video, transcript)
        _update_progress(video_id, 0.30, "Transcript complete")

        # ── Step 3: Scene detection ───────────────────────────────────────
        video.status = ProcessingStatus.ANALYZING_VISION
        db.commit()

        _update_progress(video_id, 0.35, "Detecting scenes")
        keyframes_dir = work_dir / "keyframes"
        scenes = _detect_scenes(video_path, keyframes_dir)
        scene_records = _save_scenes(db, video, scenes)
        _update_progress(video_id, 0.45, f"Found {len(scenes)} scenes")

        # ── Step 4: Pose analysis ─────────────────────────────────────────
        _update_progress(video_id, 0.50, "Analyzing pose and movement")
        all_poses = _analyze_poses(video_path, scene_records)
        _update_progress(video_id, 0.60, "Pose analysis complete")

        # ── Step 5: Action detection ──────────────────────────────────────
        video.status = ProcessingStatus.DETECTING_ACTIONS
        db.commit()

        _update_progress(video_id, 0.62, "Detecting actions")
        all_actions = _detect_actions(all_poses, transcript, scene_records)
        _save_actions(db, video, all_actions)
        _update_progress(video_id, 0.70, "Action detection complete")

        # ── Step 6: Dispatch wisdom generation ───────────────────────────
        video.status = ProcessingStatus.GENERATING_WISDOM
        db.commit()

        _update_progress(video_id, 0.72, "Generating wisdom insights")
        generate_wisdom_task.delay(
            video_id=video_id,
            scene_data=[{"id": str(s["id"]), **s} for s in scene_records],
            actions_data=all_actions,
            transcript_segments=_transcript_to_list(transcript),
        )

        return {"video_id": video_id, "status": "dispatched_wisdom_generation"}

    except Exception as e:
        log.exception("Processing failed for video %s", video_id)
        db.rollback()

        from models.video import ProcessingStatus, Video
        video = db.get(Video, uuid.UUID(video_id))
        if video:
            video.status = ProcessingStatus.FAILED
            video.error_message = str(e)
            db.commit()

        _update_progress(video_id, 0.0, f"Failed: {e}")
        raise self.retry(exc=e) if self.request.retries < self.max_retries else e

    finally:
        db.close()


@celery_app.task(
    bind=True,
    name="workers.tasks.generate_wisdom_task",
    max_retries=2,
    queue="wisdom",
)
def generate_wisdom_task(
    self: Task,
    video_id: str,
    scene_data: list[dict],
    actions_data: list[dict],
    transcript_segments: list[dict],
) -> dict:
    """Generate wisdom insights from analyzed video data using LLM."""
    db = _get_db_session()

    try:
        _update_progress(video_id, 0.75, "Running LLM wisdom extraction")

        insights = []
        for i, scene in enumerate(scene_data):
            progress = 0.75 + (i / max(len(scene_data), 1)) * 0.15
            _update_progress(video_id, progress, f"Extracting wisdom from scene {i + 1}/{len(scene_data)}")

            scene_actions = [
                a for a in actions_data
                if a.get("start_time", 0) >= scene.get("start_time", 0)
                and a.get("end_time", 0) <= scene.get("end_time", 9999)
            ]

            scene_transcript = " ".join(
                seg["text"] for seg in transcript_segments
                if seg.get("start_time", 0) >= scene.get("start_time", 0)
                and seg.get("end_time", 0) <= scene.get("end_time", 9999)
            )

            insight = _extract_scene_wisdom(scene, scene_actions, scene_transcript)
            if insight:
                saved = _save_insight(db, video_id, scene, insight)
                if saved:
                    insights.append(saved)

        _update_progress(video_id, 0.90, f"Generated {len(insights)} wisdom insights")

        # ── Step 7: Generate embeddings ───────────────────────────────────
        generate_embeddings_task.delay(
            video_id=video_id,
            insight_ids=[str(i["id"]) for i in insights],
        )

        return {"video_id": video_id, "insights_count": len(insights)}

    except Exception as e:
        log.exception("Wisdom generation failed for video %s", video_id)
        db.rollback()
        raise

    finally:
        db.close()


@celery_app.task(
    bind=True,
    name="workers.tasks.generate_embeddings_task",
    queue="embed",
)
def generate_embeddings_task(self: Task, video_id: str, insight_ids: list[str]) -> dict:
    """Generate and store embeddings for all wisdom insights."""
    db = _get_db_session()

    try:
        _update_progress(video_id, 0.92, "Generating semantic embeddings")

        from services.llm_service import EmbeddingService
        from models.video import WisdomInsight
        import numpy as np
        from pgvector.sqlalchemy import Vector

        embedder = EmbeddingService()

        batch_size = 10
        for batch_start in range(0, len(insight_ids), batch_size):
            batch_ids = insight_ids[batch_start:batch_start + batch_size]
            insights = db.query(WisdomInsight).filter(
                WisdomInsight.id.in_([uuid.UUID(i) for i in batch_ids])
            ).all()

            texts = [f"{i.title}. {i.insight_text}" for i in insights]
            embeddings = embedder.embed(texts)

            for insight, embedding in zip(insights, embeddings):
                db.execute(
                    """
                    INSERT INTO embeddings (entity_type, entity_id, model, embedding)
                    VALUES ('insight', :entity_id, 'bge-m3', :embedding)
                    ON CONFLICT DO NOTHING
                    """,
                    {"entity_id": insight.id, "embedding": str(embedding)},
                )

        db.commit()
        _update_progress(video_id, 0.95, "Building knowledge graph")

        # ── Step 8: Build Neo4j graph ─────────────────────────────────────
        _build_knowledge_graph(db, video_id, insight_ids)

        # ── Complete ──────────────────────────────────────────────────────
        from models.video import ProcessingStatus, Video
        video = db.get(Video, uuid.UUID(video_id))
        if video:
            from datetime import datetime
            video.status = ProcessingStatus.COMPLETE
            video.processing_completed_at = datetime.utcnow()
            db.commit()

        _update_progress(video_id, 1.0, "Processing complete")
        log.info("Video %s processing complete", video_id)

        return {"video_id": video_id, "status": "complete", "embeddings_count": len(insight_ids)}

    except Exception as e:
        log.exception("Embedding generation failed for video %s", video_id)
        db.rollback()
        raise

    finally:
        db.close()


@celery_app.task(name="workers.tasks.cleanup_failed_jobs")
def cleanup_failed_jobs() -> dict:
    """Periodic cleanup of stuck processing jobs."""
    from datetime import datetime, timedelta
    db = _get_db_session()
    try:
        cutoff = datetime.utcnow() - timedelta(hours=6)
        from models.video import ProcessingStatus, Video
        from sqlalchemy import update
        db.execute(
            update(Video)
            .where(Video.status.in_([
                ProcessingStatus.DOWNLOADING,
                ProcessingStatus.TRANSCRIBING,
                ProcessingStatus.ANALYZING_VISION,
                ProcessingStatus.DETECTING_ACTIONS,
                ProcessingStatus.GENERATING_WISDOM,
            ]))
            .where(Video.processing_started_at < cutoff)
            .values(
                status=ProcessingStatus.FAILED,
                error_message="Processing timeout — exceeded 6 hours",
            )
        )
        db.commit()
        return {"status": "cleanup_complete"}
    finally:
        db.close()


# ── Private helpers ────────────────────────────────────────────────────────────

def _run_async(coro):
    """Run a coroutine synchronously from Celery worker context."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _download_video(video, work_dir: Path) -> Path:
    """Download or locate video file."""
    from pipeline.video.downloader import download_video as dl_video

    if video.storage_path:
        # Already uploaded
        local_path = work_dir / "video.mp4"
        _download_from_storage(video.storage_path, local_path)
        return local_path

    # Download from URL
    result = _run_async(dl_video(video.source_url, work_dir))
    return Path(result["filepath"])


def _extract_audio_sync(video_path: Path, audio_path: Path):
    async def _inner():
        from pipeline.video.downloader import extract_audio
        await extract_audio(video_path, audio_path)
    return _inner()


def _transcribe(audio_path: Path):
    from pipeline.audio.transcriber import transcribe_audio
    return transcribe_audio(audio_path, device=settings.device)


def _detect_scenes(video_path: Path, keyframes_dir: Path) -> list:
    from pipeline.vision.scene_detector import detect_scenes
    return detect_scenes(video_path, keyframes_dir=keyframes_dir)


def _analyze_poses(video_path: Path, scene_records: list) -> list:
    from pipeline.vision.pose_analyzer import PoseAnalyzer
    analyzer = PoseAnalyzer(device=settings.device)
    all_poses = []
    for scene in scene_records:
        frames = analyzer.analyze_video_segment(
            video_path=video_path,
            start_time=scene.get("start_time", 0),
            end_time=scene.get("end_time", 60),
            sample_fps=5.0,
        )
        all_poses.extend(frames)
    return all_poses


def _detect_actions(poses, transcript, scene_records) -> list[dict]:
    from pipeline.action.action_detector import classify_actions_from_poses, enrich_actions_with_transcript
    actions = classify_actions_from_poses(poses)
    transcript_list = _transcript_to_list(transcript)
    actions = enrich_actions_with_transcript(actions, transcript_list)
    return [
        {
            "action_type": a.action_type,
            "action_subtype": a.action_subtype,
            "start_time": a.start_time,
            "end_time": a.end_time,
            "confidence": a.confidence,
            "intensity": a.intensity,
            "description": a.description,
            "pose_analysis": a.pose_analysis,
            "context_notes": a.context_notes,
        }
        for a in actions
    ]


def _extract_scene_wisdom(scene: dict, actions: list, transcript: str) -> dict | None:
    """Synchronous wisdom extraction using LLM."""
    import json
    import httpx

    if not (actions or transcript):
        return None

    # Build a simple prompt for the LLM
    actions_text = "\n".join(
        f"- {a.get('action_type')} ({a.get('start_time', 0):.1f}s-{a.get('end_time', 0):.1f}s)"
        for a in actions[:5]
    )

    prompt = f"""Analyze this Bruce Lee video moment and extract wisdom.

Scene: {scene.get('start_time', 0):.1f}s - {scene.get('end_time', 0):.1f}s
Actions: {actions_text or 'No discrete actions'}
Transcript: "{transcript or 'No speech'}"

Extract wisdom. Respond in JSON with keys:
title, insight_text, evidence_quote (or null), principle_codes (list of BL-XX codes), confidence (0-1), applications (dict with business/investing/leadership/relationships/personal_growth keys)"""

    try:
        response = httpx.post(
            f"{settings.vllm_base_url}/v1/chat/completions",
            json={
                "model": settings.llm_model,
                "messages": [
                    {"role": "system", "content": "You are a Bruce Lee wisdom analyst. Respond only in valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 800,
                "response_format": {"type": "json_object"},
            },
            headers={"Authorization": f"Bearer {settings.vllm_api_key}"},
            timeout=60.0,
        )
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)
    except Exception as e:
        log.warning("LLM wisdom extraction failed for scene: %s", e)
        return None


def _save_transcript(db, video, transcript) -> None:
    from models.video import Scene
    from sqlalchemy import insert
    db.execute(
        """
        INSERT INTO transcripts (video_id, language, full_text, word_count, confidence)
        VALUES (:video_id, :language, :full_text, :word_count, :confidence)
        ON CONFLICT (video_id, language) DO UPDATE SET full_text = EXCLUDED.full_text
        """,
        {
            "video_id": video.id,
            "language": transcript.language,
            "full_text": transcript.full_text,
            "word_count": transcript.word_count,
            "confidence": transcript.language_probability,
        },
    )
    db.commit()


def _save_scenes(db, video, scenes) -> list[dict]:
    records = []
    for scene in scenes:
        scene_id = uuid.uuid4()
        db.execute(
            """
            INSERT INTO scenes (id, video_id, scene_index, start_time, end_time, keyframe_path)
            VALUES (:id, :video_id, :scene_index, :start_time, :end_time, :keyframe_path)
            ON CONFLICT DO NOTHING
            """,
            {
                "id": scene_id,
                "video_id": video.id,
                "scene_index": scene.scene_index,
                "start_time": scene.start_time,
                "end_time": scene.end_time,
                "keyframe_path": scene.keyframe_path,
            },
        )
        records.append({
            "id": scene_id,
            "scene_index": scene.scene_index,
            "start_time": scene.start_time,
            "end_time": scene.end_time,
        })
    db.commit()
    return records


def _save_actions(db, video, actions: list[dict]) -> None:
    for action in actions:
        db.execute(
            """
            INSERT INTO detected_actions
            (id, video_id, action_type, action_subtype, start_time, end_time, confidence, intensity, context_notes)
            VALUES (:id, :video_id, :action_type, :action_subtype, :start_time, :end_time, :confidence, :intensity, :context_notes)
            """,
            {
                "id": uuid.uuid4(),
                "video_id": video.id,
                "action_type": action.get("action_type", "unknown"),
                "action_subtype": action.get("action_subtype"),
                "start_time": action.get("start_time", 0),
                "end_time": action.get("end_time", 0),
                "confidence": action.get("confidence", 0.5),
                "intensity": action.get("intensity", 0.0),
                "context_notes": action.get("context_notes", ""),
            },
        )
    db.commit()


def _save_insight(db, video_id: str, scene: dict, wisdom_data: dict) -> dict | None:
    if not wisdom_data or not wisdom_data.get("title"):
        return None

    insight_id = uuid.uuid4()
    try:
        db.execute(
            """
            INSERT INTO wisdom_insights
            (id, video_id, mentor_id, title, insight_text, evidence_quote, start_time, end_time, confidence_score)
            VALUES (:id, :video_id,
                (SELECT id FROM mentors WHERE slug = 'bruce-lee' LIMIT 1),
                :title, :insight_text, :evidence_quote, :start_time, :end_time, :confidence_score)
            """,
            {
                "id": insight_id,
                "video_id": uuid.UUID(video_id),
                "title": wisdom_data.get("title", "Untitled"),
                "insight_text": wisdom_data.get("insight_text", ""),
                "evidence_quote": wisdom_data.get("evidence_quote"),
                "start_time": scene.get("start_time"),
                "end_time": scene.get("end_time"),
                "confidence_score": wisdom_data.get("confidence", 0.5),
            },
        )

        # Save applications
        for domain, text in wisdom_data.get("applications", {}).items():
            if text:
                db.execute(
                    """
                    INSERT INTO insight_applications (id, insight_id, domain, application_text)
                    VALUES (:id, :insight_id, :domain, :application_text)
                    """,
                    {
                        "id": uuid.uuid4(),
                        "insight_id": insight_id,
                        "domain": domain,
                        "application_text": text,
                    },
                )

        db.commit()
        return {"id": insight_id, **wisdom_data}

    except Exception as e:
        log.error("Failed to save insight: %s", e)
        db.rollback()
        return None


def _build_knowledge_graph(db, video_id: str, insight_ids: list[str]) -> None:
    """Build Neo4j graph nodes and relationships."""
    try:
        from services.graph_service import GraphService
        import asyncio

        graph = GraphService()

        loop = asyncio.new_event_loop()

        from models.video import Video, WisdomInsight
        video = db.get(Video, uuid.UUID(video_id))
        if video:
            loop.run_until_complete(graph.create_video_node({
                "id": str(video.id),
                "title": video.title or "",
                "source_url": video.source_url or "",
                "duration": video.duration_seconds or 0,
            }))

        insights = db.query(WisdomInsight).filter(
            WisdomInsight.id.in_([uuid.UUID(i) for i in insight_ids])
        ).all()

        for insight in insights:
            loop.run_until_complete(graph.create_insight_node(
                insight_data={
                    "id": str(insight.id),
                    "title": insight.title,
                    "text": insight.insight_text,
                    "evidence_quote": insight.evidence_quote or "",
                    "start_time": insight.start_time or 0,
                    "confidence": insight.confidence_score,
                    "model_version": insight.model_version or "qwen2.5",
                },
                principle_codes=[],
                scene_id="",
            ))

        loop.close()
    except Exception as e:
        log.warning("Graph building partially failed: %s", e)


def _transcript_to_list(transcript) -> list[dict]:
    if not transcript:
        return []
    return [
        {
            "start_time": seg.start,
            "end_time": seg.end,
            "text": seg.text,
        }
        for seg in transcript.segments
    ]


def _download_from_storage(storage_path: str, local_path: Path) -> None:
    """Download file from MinIO/S3 to local path."""
    import boto3
    from botocore.config import Config

    s3 = boto3.client(
        "s3",
        endpoint_url=settings.storage_endpoint,
        aws_access_key_id=settings.storage_access_key,
        aws_secret_access_key=settings.storage_secret_key,
        config=Config(signature_version="s3v4"),
    )
    s3.download_file(settings.storage_bucket_videos, storage_path, str(local_path))
