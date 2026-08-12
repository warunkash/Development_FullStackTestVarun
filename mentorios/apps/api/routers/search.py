from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.search_service import SearchService

router = APIRouter(prefix="/search", tags=["search"])


class SearchResult(BaseModel):
    entity_type: str
    id: str
    title: str
    excerpt: str
    score: float
    metadata: dict = {}


class SearchResponse(BaseModel):
    query: str
    total: int
    results: list[SearchResult]


@router.get("", response_model=SearchResponse)
async def semantic_search(
    q: str = Query(..., min_length=2, description="Search query"),
    entity_types: list[str] = Query(default=["insight", "principle", "application"]),
    mentor_slug: str = "bruce-lee",
    domain: str | None = None,
    min_score: float = Query(default=0.3, ge=0.0, le=1.0),
    limit: int = Query(default=10, le=50),
    db: AsyncSession = Depends(get_db),
) -> SearchResponse:
    """
    Semantic search across wisdom insights, principles, and applications.

    Examples:
    - "show all examples of adaptability"
    - "how to handle pressure and stay calm"
    - "efficiency in business decisions"
    """
    service = SearchService(db)
    results = await service.semantic_search(
        query=q,
        entity_types=entity_types,
        mentor_slug=mentor_slug,
        domain=domain,
        min_score=min_score,
        limit=limit,
    )
    return SearchResponse(query=q, total=len(results), results=results)  # type: ignore[arg-type]


@router.get("/principles/{principle_code}/examples")
async def search_principle_examples(
    principle_code: str,
    limit: int = Query(default=10, le=50),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Find all video examples demonstrating a specific principle."""
    service = SearchService(db)
    return await service.find_principle_examples(
        principle_code=principle_code, limit=limit
    )
