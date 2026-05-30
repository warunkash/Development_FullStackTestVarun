"""Wisdom service — insights, principles, timelines."""

import uuid
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.video import Video, WisdomInsight


class WisdomService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_insights(
        self,
        video_id: uuid.UUID | None = None,
        principle_code: str | None = None,
        domain: str | None = None,
        min_confidence: float = 0.5,
        limit: int = 20,
        offset: int = 0,
    ) -> list[WisdomInsight]:
        query = (
            select(WisdomInsight)
            .where(WisdomInsight.confidence_score >= min_confidence)
            .order_by(WisdomInsight.confidence_score.desc())
            .limit(limit)
            .offset(offset)
        )

        if video_id:
            query = query.where(WisdomInsight.video_id == video_id)

        if principle_code:
            query = (
                query.join("insight_principles")
                .join("wisdom_principles")
                .where(text("wisdom_principles.code = :code"))
                .params(code=principle_code)
            )

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_insight(self, insight_id: uuid.UUID) -> WisdomInsight | None:
        result = await self.db.execute(
            select(WisdomInsight)
            .options(selectinload(WisdomInsight.applications))
            .where(WisdomInsight.id == insight_id)
        )
        return result.scalar_one_or_none()

    async def list_principles(
        self,
        mentor_slug: str = "bruce-lee",
        tier: int | None = None,
    ) -> list[dict]:
        query = text("""
            SELECT
                wp.id, wp.code, wp.name, wp.tier, wp.description, wp.definition,
                COUNT(ip.insight_id) as example_count
            FROM wisdom_principles wp
            JOIN mentors m ON m.id = wp.mentor_id
            LEFT JOIN insight_principles ip ON ip.principle_id = wp.id
            WHERE m.slug = :mentor_slug
            {tier_filter}
            GROUP BY wp.id
            ORDER BY wp.tier ASC, wp.name ASC
        """.format(tier_filter="AND wp.tier = :tier" if tier else ""))

        params: dict[str, Any] = {"mentor_slug": mentor_slug}
        if tier:
            params["tier"] = tier

        result = await self.db.execute(query, params)
        return [dict(row._mapping) for row in result.fetchall()]

    async def build_timeline(self, video_id: uuid.UUID) -> dict | None:
        video = await self.db.get(Video, video_id)
        if not video:
            return None

        result = await self.db.execute(
            select(WisdomInsight)
            .where(WisdomInsight.video_id == video_id)
            .where(WisdomInsight.start_time.is_not(None))
            .order_by(WisdomInsight.start_time)
        )
        insights = result.scalars().all()

        annotations = []
        for insight in insights:
            annotation = {
                "type": "wisdom",
                "start_time": insight.start_time,
                "end_time": insight.end_time,
                "title": insight.title,
                "text": insight.insight_text[:200],
                "confidence": insight.confidence_score,
                "insight_id": str(insight.id),
            }
            annotations.append(annotation)

        return {
            "video_id": str(video_id),
            "duration_seconds": video.duration_seconds,
            "annotations": annotations,
        }

    async def get_video_subgraph(self, video_id: uuid.UUID, depth: int = 2) -> dict:
        from services.graph_service import GraphService

        graph = GraphService()
        return await graph.get_video_subgraph(str(video_id), depth)

    async def get_domain_applications(
        self,
        domain: str,
        mentor_slug: str = "bruce-lee",
        limit: int = 20,
    ) -> list[dict]:
        query = text("""
            SELECT
                ia.id,
                ia.application_text,
                ia.example,
                wi.title as insight_title,
                wi.id as insight_id,
                wi.confidence_score,
                v.title as video_title,
                v.id as video_id,
                wi.start_time
            FROM insight_applications ia
            JOIN wisdom_insights wi ON wi.id = ia.insight_id
            JOIN videos v ON v.id = wi.video_id
            JOIN mentors m ON m.id = wi.mentor_id
            WHERE ia.domain = :domain
              AND m.slug = :mentor_slug
            ORDER BY wi.confidence_score DESC
            LIMIT :limit
        """)

        result = await self.db.execute(
            query, {"domain": domain, "mentor_slug": mentor_slug, "limit": limit}
        )
        return [dict(row._mapping) for row in result.fetchall()]
