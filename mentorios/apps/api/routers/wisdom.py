import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.wisdom_service import WisdomService

router = APIRouter(prefix="/wisdom", tags=["wisdom"])


class InsightResponse(BaseModel):
    id: uuid.UUID
    video_id: uuid.UUID
    title: str
    insight_text: str
    evidence_quote: str | None
    start_time: float | None
    end_time: float | None
    confidence_score: float
    principles: list[dict] = []
    applications: list[dict] = []
    created_at: str

    class Config:
        from_attributes = True


class PrincipleResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    tier: int
    description: str
    definition: str
    example_count: int = 0


class TimelineResponse(BaseModel):
    video_id: uuid.UUID
    duration_seconds: float | None
    annotations: list[dict]


@router.get("/insights", response_model=list[InsightResponse])
async def list_insights(
    video_id: uuid.UUID | None = None,
    principle_code: str | None = None,
    domain: str | None = None,
    min_confidence: float = Query(default=0.5, ge=0.0, le=1.0),
    limit: int = Query(default=20, le=100),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> list[InsightResponse]:
    """List wisdom insights with optional filtering."""
    service = WisdomService(db)
    insights = await service.list_insights(
        video_id=video_id,
        principle_code=principle_code,
        domain=domain,
        min_confidence=min_confidence,
        limit=limit,
        offset=offset,
    )
    return [InsightResponse.model_validate(i) for i in insights]


@router.get("/insights/{insight_id}", response_model=InsightResponse)
async def get_insight(
    insight_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> InsightResponse:
    """Get a specific wisdom insight."""
    service = WisdomService(db)
    insight = await service.get_insight(insight_id)
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    return InsightResponse.model_validate(insight)


@router.get("/principles", response_model=list[PrincipleResponse])
async def list_principles(
    mentor_slug: str = "bruce-lee",
    tier: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[PrincipleResponse]:
    """List all wisdom principles for a mentor."""
    service = WisdomService(db)
    principles = await service.list_principles(mentor_slug=mentor_slug, tier=tier)
    return [PrincipleResponse.model_validate(p) for p in principles]


@router.get("/timeline/{video_id}", response_model=TimelineResponse)
async def get_video_timeline(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get annotated timeline for a video."""
    service = WisdomService(db)
    timeline = await service.build_timeline(video_id)
    if not timeline:
        raise HTTPException(status_code=404, detail="Video not found")
    return timeline  # type: ignore[return-value]


@router.get("/graph/subgraph/{video_id}")
async def get_wisdom_subgraph(
    video_id: uuid.UUID,
    depth: int = Query(default=2, ge=1, le=4),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get the wisdom knowledge subgraph for a video (for graph visualization)."""
    service = WisdomService(db)
    subgraph = await service.get_video_subgraph(video_id, depth=depth)
    return subgraph


@router.get("/applications/{domain}")
async def get_domain_applications(
    domain: str,
    mentor_slug: str = "bruce-lee",
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Get all wisdom applications for a specific domain."""
    valid_domains = [
        "business",
        "investing",
        "leadership",
        "relationships",
        "personal_growth",
        "athletics",
    ]
    if domain not in valid_domains:
        raise HTTPException(
            status_code=400, detail=f"Invalid domain. Choose from: {valid_domains}"
        )

    service = WisdomService(db)
    return await service.get_domain_applications(
        domain=domain, mentor_slug=mentor_slug, limit=limit
    )
