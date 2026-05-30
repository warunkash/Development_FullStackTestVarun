"""
Mentor Agent — Conversational interface grounded in source material.

Uses RAG (Retrieval-Augmented Generation) to ensure all responses
are traceable to actual video evidence. Never fabricates.
"""

import json
import logging
from dataclasses import dataclass
from typing import Any, AsyncIterator

log = logging.getLogger(__name__)


@dataclass
class Citation:
    video_id: str
    video_title: str
    timestamp_start: float
    timestamp_end: float
    quote: str | None
    confidence: float


@dataclass
class MentorResponse:
    content: str
    citations: list[Citation]
    confidence: float
    principle_codes: list[str]


MENTOR_SYSTEM_PROMPT = """You are MentorOS — an AI that channels the wisdom of {mentor_name}.

IMPORTANT CONSTRAINTS:
1. Only reference knowledge from the provided context (video evidence)
2. If the context doesn't support a claim, say "I don't have evidence for this in the analyzed videos"
3. Always cite your sources (video timestamps)
4. Express uncertainty honestly — use confidence language ("appears to", "suggests", "demonstrates")
5. Respond as if you are helping someone genuinely understand {mentor_name}'s philosophy
6. Never fabricate quotes or events

MENTOR PROFILE:
{mentor_bio}

WISDOM TAXONOMY:
{principles_summary}

When answering:
- Ground every insight in observable evidence from the video context
- Provide specific video timestamps when referencing actions or statements
- Translate principles to the user's domain when asked
- Acknowledge the limits of what can be inferred from video alone"""


QUERY_TYPES = {
    "why": "Asking about intent or motivation behind an action",
    "what": "Asking about a specific action or event",
    "how": "Asking about application or technique",
    "apply": "Asking for cross-domain application",
    "compare": "Comparing with other concepts",
    "show": "Requesting examples",
    "explain": "Requesting explanation of a principle",
}


class MentorAgent:
    def __init__(
        self,
        llm_client: Any,
        search_service: Any,
        graph_service: Any,
        mentor_data: dict,
        model: str = "Qwen/Qwen2.5-72B-Instruct",
    ):
        self.llm = llm_client
        self.search = search_service
        self.graph = graph_service
        self.mentor = mentor_data
        self.model = model

    async def respond(
        self,
        message: str,
        conversation_history: list[dict],
        video_id: str | None = None,
        timestamp: float | None = None,
    ) -> MentorResponse:
        """Generate a grounded mentor response."""
        context = await self._retrieve_context(message, video_id, timestamp)
        citations = self._extract_citations(context)
        response_text = await self._generate_response(
            message=message,
            context=context,
            history=conversation_history,
        )
        confidence = self._estimate_confidence(context, response_text)
        principles = self._extract_mentioned_principles(response_text)

        return MentorResponse(
            content=response_text,
            citations=citations,
            confidence=confidence,
            principle_codes=principles,
        )

    async def stream_response(
        self,
        message: str,
        conversation_history: list[dict],
        video_id: str | None = None,
        timestamp: float | None = None,
    ) -> AsyncIterator[str]:
        """Stream a mentor response token by token."""
        context = await self._retrieve_context(message, video_id, timestamp)

        system_prompt = MENTOR_SYSTEM_PROMPT.format(
            mentor_name=self.mentor.get("name", "Bruce Lee"),
            mentor_bio=self.mentor.get("bio", ""),
            principles_summary=self._format_principles(),
        )

        messages = [*conversation_history, {"role": "user", "content": message}]

        context_block = self._format_context_for_prompt(context)
        enhanced_message = f"{context_block}\n\nUser question: {message}"
        messages[-1]["content"] = enhanced_message

        async for chunk in self.llm.stream_chat(
            model=self.model,
            system=system_prompt,
            messages=messages,
            temperature=0.5,
            max_tokens=1500,
        ):
            yield chunk

    async def _retrieve_context(
        self,
        query: str,
        video_id: str | None,
        timestamp: float | None,
    ) -> list[dict]:
        """Retrieve relevant wisdom context using hybrid search."""
        context_items = []

        # Vector search for semantically similar insights
        search_results = await self.search.semantic_search(
            query=query,
            entity_types=["insight", "application"],
            mentor_slug=self.mentor.get("slug", "bruce-lee"),
            limit=5,
        )
        context_items.extend(search_results)

        # If video-specific query, get timeline context
        if video_id and timestamp is not None:
            timeline_context = await self._get_timestamp_context(video_id, timestamp)
            context_items.extend(timeline_context)
        elif video_id:
            video_insights = await self._get_video_insights(video_id)
            context_items.extend(video_insights[:5])

        # Graph traversal for principle relationships
        if context_items:
            principle_codes = []
            for item in context_items:
                principle_codes.extend(item.get("principle_codes", []))

            if principle_codes:
                related = await self._get_related_principles(list(set(principle_codes[:3])))
                context_items.extend(related)

        return context_items[:10]  # Cap at 10 context items

    async def _get_timestamp_context(self, video_id: str, timestamp: float) -> list[dict]:
        """Get wisdom context for a specific video timestamp."""
        insights = await self.search.get_insights_by_timestamp(
            video_id=video_id,
            timestamp=timestamp,
            window_seconds=30,
        )
        return insights

    async def _get_video_insights(self, video_id: str) -> list[dict]:
        """Get top insights from a specific video."""
        return await self.search.get_top_insights(video_id=video_id, limit=5)

    async def _get_related_principles(self, principle_codes: list[str]) -> list[dict]:
        """Get graph-traversal context for principles."""
        return await self.graph.get_principle_context(principle_codes)

    async def _generate_response(
        self,
        message: str,
        context: list[dict],
        history: list[dict],
    ) -> str:
        """Generate response using retrieved context."""
        system_prompt = MENTOR_SYSTEM_PROMPT.format(
            mentor_name=self.mentor.get("name", "Bruce Lee"),
            mentor_bio=self.mentor.get("bio", ""),
            principles_summary=self._format_principles(),
        )

        context_block = self._format_context_for_prompt(context)
        enhanced_message = f"{context_block}\n\nUser question: {message}"

        messages = [*history, {"role": "user", "content": enhanced_message}]

        return await self.llm.chat(
            model=self.model,
            system=system_prompt,
            messages=messages,
            temperature=0.5,
            max_tokens=1500,
        )

    def _format_context_for_prompt(self, context: list[dict]) -> str:
        if not context:
            return "EVIDENCE CONTEXT:\n(No specific video evidence retrieved for this query)"

        lines = ["EVIDENCE CONTEXT (from analyzed Bruce Lee videos):"]
        for i, item in enumerate(context, 1):
            item_type = item.get("entity_type", "insight")
            lines.append(f"\n[{i}] {item_type.upper()}: {item.get('title', 'Untitled')}")

            if item.get("start_time") is not None:
                lines.append(f"    Timestamp: {item['start_time']:.1f}s")

            if item.get("video_title"):
                lines.append(f"    Source: {item['video_title']}")

            if item.get("insight_text"):
                lines.append(f"    Content: {item['insight_text']}")

            if item.get("evidence_quote"):
                lines.append(f"    Quote: \"{item['evidence_quote']}\"")

            if item.get("principle_codes"):
                lines.append(f"    Principles: {', '.join(item['principle_codes'])}")

        return "\n".join(lines)

    def _format_principles(self) -> str:
        return """
BL-AD: Adaptability — Be formless like water
BL-FL: Flow — Continuous natural motion
BL-TM: Timing — Perfect moment selection
BL-IN: Interception — Address threats at their source
BL-EF: Efficiency — Maximum impact, minimum effort
BL-DR: Directness — Straight path, no wasted movement
BL-AW: Awareness — Full situational awareness
BL-PO: Positioning — Strategic placement before action
BL-SI: Simplicity — Eliminate the non-essential
BL-NR: Non-Resistance — Yield to redirect
BL-PR: Presence — Complete focus
BL-SE: Self-Expression — Authentic action
BL-EC: Emotional Control — Channel emotion productively
BL-CG: Continuous Growth — Daily improvement
BL-DT: Detachment — Non-attachment to outcomes
"""

    def _extract_citations(self, context: list[dict]) -> list[Citation]:
        citations = []
        for item in context:
            if item.get("video_id") and item.get("start_time") is not None:
                citations.append(Citation(
                    video_id=item["video_id"],
                    video_title=item.get("video_title", ""),
                    timestamp_start=item.get("start_time", 0),
                    timestamp_end=item.get("end_time", 0),
                    quote=item.get("evidence_quote"),
                    confidence=item.get("score", 0.8),
                ))
        return citations

    def _estimate_confidence(self, context: list[dict], response: str) -> float:
        """Estimate response confidence based on context quality."""
        if not context:
            return 0.3

        avg_context_score = sum(
            item.get("score", 0.5) for item in context
        ) / len(context)

        uncertainty_markers = ["might", "possibly", "unclear", "uncertain", "don't have evidence"]
        has_uncertainty = any(m in response.lower() for m in uncertainty_markers)

        base_confidence = avg_context_score
        if has_uncertainty:
            base_confidence *= 0.8

        return round(base_confidence, 2)

    def _extract_mentioned_principles(self, text: str) -> list[str]:
        """Extract principle codes mentioned in response."""
        codes = ["BL-AD", "BL-FL", "BL-TM", "BL-IN", "BL-EF", "BL-DR",
                 "BL-AW", "BL-PO", "BL-SI", "BL-NR", "BL-PR",
                 "BL-SE", "BL-EC", "BL-CG", "BL-DT"]
        return [code for code in codes if code in text]
