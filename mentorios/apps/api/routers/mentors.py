from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.user import Mentor

router = APIRouter(prefix="/mentors", tags=["mentors"])


class MentorResponse(BaseModel):
    id: str
    slug: str
    name: str
    birth_year: int | None
    death_year: int | None
    bio: str | None
    thumbnail_url: str | None
    is_active: bool

    class Config:
        from_attributes = True


@router.get("", response_model=list[MentorResponse])
async def list_mentors(db: AsyncSession = Depends(get_db)) -> list[MentorResponse]:
    """List all available mentors."""
    result = await db.execute(
        select(Mentor).where(Mentor.is_active).order_by(Mentor.name)
    )
    mentors = result.scalars().all()
    return [MentorResponse.model_validate(m) for m in mentors]


@router.get("/{slug}", response_model=MentorResponse)
async def get_mentor(slug: str, db: AsyncSession = Depends(get_db)) -> MentorResponse:
    """Get a specific mentor by slug."""
    mentor = await db.scalar(select(Mentor).where(Mentor.slug == slug))
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")
    return MentorResponse.model_validate(mentor)
