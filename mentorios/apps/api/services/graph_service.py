"""Neo4j graph service — wisdom graph operations."""

import logging

from core.database import get_neo4j_driver

log = logging.getLogger(__name__)


class GraphService:
    def __init__(self):
        self.driver = get_neo4j_driver()

    async def create_video_node(self, video_data: dict) -> str:
        async with self.driver.session() as session:
            result = await session.run(
                """
                MERGE (v:Video {id: $id})
                SET v += {
                    title: $title,
                    source_url: $source_url,
                    duration: $duration,
                    processed_at: datetime()
                }
                RETURN v.id as id
                """,
                **video_data,
            )
            record = await result.single()
            return record["id"]

    async def create_scene_node(self, scene_data: dict) -> str:
        async with self.driver.session() as session:
            result = await session.run(
                """
                MERGE (s:Scene {id: $id})
                SET s += {
                    video_id: $video_id,
                    scene_index: $scene_index,
                    start_time: $start_time,
                    end_time: $end_time,
                    scene_type: $scene_type,
                    environment: $environment
                }
                WITH s
                MATCH (v:Video {id: $video_id})
                MERGE (v)-[:CONTAINS]->(s)
                RETURN s.id as id
                """,
                **scene_data,
            )
            record = await result.single()
            return record["id"]

    async def create_insight_node(
        self,
        insight_data: dict,
        principle_codes: list[str],
        scene_id: str,
    ) -> str:
        async with self.driver.session() as session:
            result = await session.run(
                """
                MERGE (l:Lesson {id: $id})
                SET l += {
                    title: $title,
                    text: $text,
                    evidence_quote: $evidence_quote,
                    start_time: $start_time,
                    confidence: $confidence,
                    model_version: $model_version
                }
                WITH l
                MATCH (s:Scene {id: $scene_id})
                MERGE (s)-[:TEACHES]->(l)
                RETURN l.id as id
                """,
                scene_id=scene_id,
                **insight_data,
            )
            record = await result.single()
            lesson_id = record["id"]

            # Link to principles
            for code in principle_codes:
                await session.run(
                    """
                    MATCH (l:Lesson {id: $lesson_id})
                    MATCH (p:Principle {code: $code})
                    MERGE (l)-[:GROUNDED_IN]->(p)
                    """,
                    lesson_id=lesson_id,
                    code=code,
                )

            return lesson_id

    async def create_application_node(
        self,
        insight_id: str,
        domain: str,
        application_text: str,
        example: str | None = None,
    ) -> None:
        async with self.driver.session() as session:
            await session.run(
                """
                MERGE (app:Application {id: $id})
                SET app += {domain: $domain, title: $title, text: $text, example: $example}
                WITH app
                MATCH (l:Lesson {id: $insight_id})
                MERGE (l)-[:APPLIES_TO {domain: $domain}]->(app)
                """,
                id=f"{insight_id}:{domain}",
                insight_id=insight_id,
                domain=domain,
                title=f"{domain.title()} Application",
                text=application_text,
                example=example or "",
            )

    async def seed_principles(self, mentor_id: str, principles: list[dict]) -> None:
        """Seed wisdom principle nodes for a mentor."""
        async with self.driver.session() as session:
            await session.run(
                """
                MERGE (m:Mentor {id: $mentor_id})
                """,
                mentor_id=mentor_id,
            )

            for p in principles:
                await session.run(
                    """
                    MERGE (pr:Principle {code: $code})
                    SET pr += {
                        id: $id,
                        name: $name,
                        tier: $tier,
                        description: $description,
                        definition: $definition,
                        mentor_id: $mentor_id
                    }
                    WITH pr
                    MATCH (m:Mentor {id: $mentor_id})
                    MERGE (m)-[:TEACHES]->(pr)
                    """,
                    mentor_id=mentor_id,
                    **{
                        k: p[k]
                        for k in [
                            "id",
                            "code",
                            "name",
                            "tier",
                            "description",
                            "definition",
                        ]
                    },
                )

    async def get_principle_context(self, principle_codes: list[str]) -> list[dict]:
        """Get related principles and lessons for given codes."""
        async with self.driver.session() as session:
            result = await session.run(
                """
                MATCH (p:Principle)
                WHERE p.code IN $codes
                OPTIONAL MATCH (p)-[:SUPPORTS|RELATES_TO]-(related:Principle)
                OPTIONAL MATCH (l:Lesson)-[:GROUNDED_IN]->(p)
                RETURN p, collect(DISTINCT related) as related_principles,
                       collect(DISTINCT l)[..3] as sample_lessons
                """,
                codes=principle_codes,
            )

            records = await result.data()
            context = []
            for record in records:
                p = record["p"]
                context.append(
                    {
                        "entity_type": "principle",
                        "id": p.get("id", ""),
                        "code": p.get("code", ""),
                        "title": p.get("name", ""),
                        "insight_text": p.get("definition", ""),
                        "score": 0.7,
                        "related_principles": [
                            r.get("name") for r in record["related_principles"] if r
                        ],
                        "sample_lessons": [
                            {"title": lesson.get("title"), "text": lesson.get("text")}
                            for lesson in record["sample_lessons"]
                            if lesson
                        ],
                    }
                )
            return context

    async def get_video_subgraph(self, video_id: str, depth: int = 2) -> dict:
        """Export wisdom subgraph for a video as node/edge JSON."""
        async with self.driver.session() as session:
            result = await session.run(
                """
                MATCH (v:Video {id: $video_id})-[:CONTAINS]->(s:Scene)
                MATCH (s)-[:TEACHES]->(l:Lesson)
                OPTIONAL MATCH (l)-[:GROUNDED_IN]->(p:Principle)
                OPTIONAL MATCH (l)-[:APPLIES_TO]->(app:Application)
                RETURN
                    collect(DISTINCT {id: v.id, type: 'Video', label: v.title}) as videos,
                    collect(DISTINCT {id: s.id, type: 'Scene', label: toString(s.start_time)}) as scenes,
                    collect(DISTINCT {id: l.id, type: 'Lesson', label: l.title}) as lessons,
                    collect(DISTINCT {id: p.id, type: 'Principle', label: p.name}) as principles,
                    collect(DISTINCT {id: app.id, type: 'Application', label: app.domain}) as applications
                """,
                video_id=video_id,
            )

            record = await result.single()
            if not record:
                return {"nodes": [], "edges": []}

            nodes = []
            for node_list in [
                record["videos"],
                record["scenes"],
                record["lessons"],
                record["principles"],
                record["applications"],
            ]:
                nodes.extend([n for n in node_list if n and n.get("id")])

            return {"nodes": nodes, "edges": []}
