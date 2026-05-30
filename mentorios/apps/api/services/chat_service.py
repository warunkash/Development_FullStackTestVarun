"""Chat service — manages sessions and streams mentor responses."""

import json
import uuid
from typing import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.user import ChatMessage, ChatSession


class ChatService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_session(
        self,
        user_id: uuid.UUID,
        mentor_id: uuid.UUID | None = None,
        video_id: uuid.UUID | None = None,
        title: str | None = None,
    ) -> ChatSession:
        session = ChatSession(
            user_id=user_id,
            mentor_id=mentor_id,
            video_id=video_id,
            title=title or "New conversation",
        )
        self.db.add(session)
        await self.db.flush()
        return session

    async def list_sessions(
        self,
        user_id: uuid.UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> list[ChatSession]:
        result = await self.db.execute(
            select(ChatSession)
            .where(ChatSession.user_id == user_id)
            .order_by(ChatSession.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def get_messages(self, session_id: uuid.UUID) -> list[ChatMessage]:
        result = await self.db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
        )
        return list(result.scalars().all())

    async def add_message(
        self,
        session_id: uuid.UUID,
        role: str,
        content: str,
        citations: list[dict] | None = None,
        confidence: float | None = None,
    ) -> ChatMessage:
        message = ChatMessage(
            session_id=session_id,
            role=role,
            content=content,
        )
        self.db.add(message)
        await self.db.flush()
        return message

    async def stream_response(
        self,
        session_id: uuid.UUID,
        message: str,
    ) -> AsyncIterator[str]:
        """Stream mentor agent response."""
        history = await self._get_conversation_history(session_id)

        await self.add_message(session_id, "user", message)

        session = await self.db.get(ChatSession, session_id)

        from agents.mentor_agent import MentorAgent
        from services.llm_service import LLMService
        from services.search_service import SearchService
        from services.graph_service import GraphService

        llm = LLMService()
        search = SearchService(self.db)
        graph = GraphService()

        mentor_data = {
            "name": "Bruce Lee",
            "slug": "bruce-lee",
            "bio": (
                "Bruce Lee (1940-1973) was a martial artist, philosopher, actor, and filmmaker. "
                "He developed Jeet Kune Do, a hybrid martial arts philosophy emphasizing practicality, "
                "efficiency, and the importance of adapting to any situation."
            ),
        }

        agent = MentorAgent(
            llm_client=llm,
            search_service=search,
            graph_service=graph,
            mentor_data=mentor_data,
        )

        full_response = []
        async for chunk in agent.stream_response(
            message=message,
            conversation_history=history,
            video_id=str(session.video_id) if session and session.video_id else None,
        ):
            full_response.append(chunk)
            yield json.dumps({"chunk": chunk, "done": False})

        complete_response = "".join(full_response)
        await self.add_message(session_id, "assistant", complete_response)

        yield json.dumps({"chunk": "", "done": True, "full_response": complete_response})

    async def _get_conversation_history(self, session_id: uuid.UUID) -> list[dict]:
        messages = await self.get_messages(session_id)
        return [
            {"role": m.role, "content": m.content}
            for m in messages[-20:]  # Keep last 20 messages for context
        ]
