import uuid
from typing import Annotated, AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    session_id: uuid.UUID | None = None
    mentor_id: uuid.UUID | None = None
    video_id: uuid.UUID | None = None


class ChatSessionResponse(BaseModel):
    id: uuid.UUID
    title: str | None
    mentor_id: uuid.UUID | None
    video_id: uuid.UUID | None
    created_at: str


class MessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    citations: list[dict] = []
    confidence: float | None
    created_at: str


@router.post("/sessions", response_model=ChatSessionResponse)
async def create_session(
    mentor_id: uuid.UUID | None = None,
    video_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> ChatSessionResponse:
    """Create a new chat session."""
    service = ChatService(db)
    session = await service.create_session(
        user_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
        mentor_id=mentor_id,
        video_id=video_id,
    )
    return ChatSessionResponse.model_validate(session)


@router.get("/sessions", response_model=list[ChatSessionResponse])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    limit: int = 20,
    offset: int = 0,
) -> list[ChatSessionResponse]:
    """List chat sessions for current user."""
    service = ChatService(db)
    sessions = await service.list_sessions(
        user_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
        limit=limit,
        offset=offset,
    )
    return [ChatSessionResponse.model_validate(s) for s in sessions]


@router.get("/sessions/{session_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[MessageResponse]:
    """Get all messages in a chat session."""
    service = ChatService(db)
    messages = await service.get_messages(session_id)
    return [MessageResponse.model_validate(m) for m in messages]


@router.post("/stream")
async def stream_chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream a chat response using Server-Sent Events."""
    service = ChatService(db)

    if not request.session_id:
        session = await service.create_session(
            user_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            mentor_id=request.mentor_id,
            video_id=request.video_id,
        )
        session_id = session.id
    else:
        session_id = request.session_id

    async def event_generator() -> AsyncIterator[str]:
        async for chunk in service.stream_response(
            session_id=session_id,
            message=request.message,
        ):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
