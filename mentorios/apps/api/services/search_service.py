"""Search service — hybrid vector + full-text + graph search."""

import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from models.video import WisdomInsight


class SearchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def semantic_search(
        self,
        query: str,
        entity_types: list[str],
        mentor_slug: str = "bruce-lee",
        domain: str | None = None,
        min_score: float = 0.3,
        limit: int = 10,
    ) -> list[dict]:
        """Hybrid semantic + keyword search across wisdom content."""
        from services.llm_service import EmbeddingService

        embedder = EmbeddingService()
        query_embedding = embedder.embed_single(query)

        results = []

        if "insight" in entity_types or "application" in entity_types:
            vector_results = await self._vector_search_insights(
                query_embedding=query_embedding,
                limit=limit,
                min_score=min_score,
            )
            results.extend(vector_results)

        results.sort(key=lambda x: x.get("score", 0), reverse=True)
        return results[:limit]

    async def _vector_search_insights(
        self,
        query_embedding: list[float],
        limit: int,
        min_score: float,
    ) -> list[dict]:
        """pgvector cosine similarity search on insight embeddings."""
        query = text("""
            SELECT
                wi.id,
                wi.title,
                wi.insight_text,
                wi.evidence_quote,
                wi.start_time,
                wi.end_time,
                wi.confidence_score,
                v.title as video_title,
                v.id as video_id,
                1 - (e.embedding <=> :query_vec::vector) as score
            FROM wisdom_insights wi
            JOIN embeddings e ON e.entity_id = wi.id AND e.entity_type = 'insight'
            JOIN videos v ON v.id = wi.video_id
            WHERE 1 - (e.embedding <=> :query_vec::vector) > :min_score
            ORDER BY e.embedding <=> :query_vec::vector
            LIMIT :limit
        """)

        result = await self.db.execute(
            query,
            {
                "query_vec": str(query_embedding),
                "min_score": min_score,
                "limit": limit,
            },
        )

        rows = result.fetchall()
        return [
            {
                "entity_type": "insight",
                "id": str(row.id),
                "title": row.title,
                "insight_text": row.insight_text,
                "evidence_quote": row.evidence_quote,
                "start_time": row.start_time,
                "end_time": row.end_time,
                "video_id": str(row.video_id),
                "video_title": row.video_title,
                "score": float(row.score),
                "excerpt": (
                    row.insight_text[:200] + "..."
                    if len(row.insight_text) > 200
                    else row.insight_text
                ),
            }
            for row in rows
        ]

    async def find_principle_examples(
        self,
        principle_code: str,
        limit: int = 10,
    ) -> dict:
        """Find all video examples demonstrating a specific principle."""
        query = text("""
            SELECT
                wi.id,
                wi.title,
                wi.insight_text,
                wi.start_time,
                wi.end_time,
                wi.confidence_score,
                v.title as video_title,
                v.id as video_id,
                v.thumbnail_url,
                wp.name as principle_name,
                ip.relevance_score
            FROM wisdom_insights wi
            JOIN insight_principles ip ON ip.insight_id = wi.id
            JOIN wisdom_principles wp ON wp.id = ip.principle_id
            JOIN videos v ON v.id = wi.video_id
            WHERE wp.code = :principle_code
            ORDER BY ip.relevance_score DESC, wi.confidence_score DESC
            LIMIT :limit
        """)

        result = await self.db.execute(
            query, {"principle_code": principle_code, "limit": limit}
        )
        rows = result.fetchall()

        return {
            "principle_code": principle_code,
            "example_count": len(rows),
            "examples": [
                {
                    "insight_id": str(row.id),
                    "title": row.title,
                    "insight_text": row.insight_text,
                    "start_time": row.start_time,
                    "end_time": row.end_time,
                    "confidence": row.confidence_score,
                    "video_title": row.video_title,
                    "video_id": str(row.video_id),
                    "thumbnail_url": row.thumbnail_url,
                    "relevance": row.relevance_score,
                }
                for row in rows
            ],
        }

    async def get_insights_by_timestamp(
        self,
        video_id: str,
        timestamp: float,
        window_seconds: float = 30,
    ) -> list[dict]:
        """Get wisdom insights within a time window of a given timestamp."""
        query = text("""
            SELECT wi.*, v.title as video_title
            FROM wisdom_insights wi
            JOIN videos v ON v.id = wi.video_id
            WHERE wi.video_id = :video_id
              AND wi.start_time >= :ts_start
              AND wi.end_time <= :ts_end
            ORDER BY wi.confidence_score DESC
        """)

        result = await self.db.execute(
            query,
            {
                "video_id": video_id,
                "ts_start": max(0, timestamp - window_seconds),
                "ts_end": timestamp + window_seconds,
            },
        )
        rows = result.fetchall()
        return [dict(row._mapping) for row in rows]

    async def get_top_insights(self, video_id: str, limit: int = 5) -> list[dict]:
        """Get the highest confidence insights from a video."""
        result = await self.db.execute(
            select(WisdomInsight)
            .where(WisdomInsight.video_id == uuid.UUID(video_id))
            .order_by(WisdomInsight.confidence_score.desc())
            .limit(limit)
        )
        insights = result.scalars().all()
        return [
            {
                "entity_type": "insight",
                "id": str(i.id),
                "title": i.title,
                "insight_text": i.insight_text,
                "start_time": i.start_time,
                "score": i.confidence_score,
            }
            for i in insights
        ]
