"""Unit tests for wisdom extraction pipeline."""

import json
from unittest.mock import AsyncMock

import pytest

from pipeline.wisdom.wisdom_extractor import (
    _format_actions,
    _summarize_movement,
    extract_wisdom_from_scene,
)


class TestFormatActions:
    def test_empty_actions(self):
        result = _format_actions([])
        assert result == "No discrete actions detected"

    def test_single_action(self):
        actions = [
            {
                "action_type": "strike",
                "start_time": 1.0,
                "end_time": 2.0,
                "intensity": 0.8,
            }
        ]
        result = _format_actions(actions)
        assert "strike" in result
        assert "1.0s-2.0s" in result

    def test_action_with_subtype(self):
        actions = [
            {
                "action_type": "strike",
                "action_subtype": "jab",
                "start_time": 1.0,
                "end_time": 1.5,
            }
        ]
        result = _format_actions(actions)
        assert "jab" in result

    def test_multiple_actions(self):
        actions = [
            {"action_type": "stance", "start_time": 0.0, "end_time": 1.0},
            {"action_type": "strike", "start_time": 1.5, "end_time": 2.0},
        ]
        result = _format_actions(actions)
        assert "stance" in result
        assert "strike" in result


class TestSummarizeMovement:
    def test_empty_actions(self):
        result = _summarize_movement([])
        assert result["intensity"] == 0.0
        assert result["dominant"] == "none"

    def test_single_action_intensity(self):
        actions = [{"action_type": "strike", "intensity": 0.8}]
        result = _summarize_movement(actions)
        assert result["intensity"] == 0.8
        assert result["dominant"] == "strike"

    def test_dominant_action(self):
        actions = [
            {"action_type": "stance", "intensity": 0.2},
            {"action_type": "strike", "intensity": 0.9},
            {"action_type": "strike", "intensity": 0.7},
        ]
        result = _summarize_movement(actions)
        assert result["dominant"] == "strike"


@pytest.mark.asyncio
class TestExtractWisdomFromScene:
    async def test_returns_none_with_no_content(self):
        mock_llm = AsyncMock()
        result = await extract_wisdom_from_scene(
            scene_data={"start_time": 0, "end_time": 5},
            actions=[],
            transcript_text="",
            llm_client=mock_llm,
        )
        assert result is None

    async def test_successful_extraction(self):
        mock_response = json.dumps(
            {
                "title": "The Water Metaphor",
                "intent": "Teaching philosophical principle through natural analogy",
                "insight_text": "Bruce Lee demonstrates adaptability by using water as a metaphor.",
                "evidence_quote": "Be water, my friend",
                "principle_codes": ["BL-AD", "BL-FL"],
                "confidence": 0.88,
                "applications": {
                    "business": "Pivot strategy as market conditions change",
                    "investing": "Adapt portfolio to market regimes",
                    "leadership": "Lead differently in different contexts",
                    "relationships": "Meet people where they are",
                    "personal_growth": "Release rigid attachments to fixed approaches",
                },
                "reasoning": "The water metaphor directly demonstrates formlessness (BL-AD) and flow (BL-FL)",
            }
        )

        mock_llm = AsyncMock()
        mock_llm.chat = AsyncMock(return_value=mock_response)

        result = await extract_wisdom_from_scene(
            scene_data={
                "start_time": 10.0,
                "end_time": 45.0,
                "scene_type": "interview",
            },
            actions=[
                {
                    "action_type": "verbal",
                    "start_time": 10.0,
                    "end_time": 45.0,
                    "intensity": 0.2,
                }
            ],
            transcript_text="Be water, my friend. Empty your mind.",
            llm_client=mock_llm,
        )

        assert result is not None
        assert result.title == "The Water Metaphor"
        assert "BL-AD" in result.principle_codes
        assert "BL-FL" in result.principle_codes
        assert result.confidence == 0.88
        assert result.evidence_quote == "Be water, my friend"
        assert "business" in result.applications

    async def test_filters_invalid_principle_codes(self):
        mock_response = json.dumps(
            {
                "title": "Test",
                "intent": "Test",
                "insight_text": "Test insight",
                "evidence_quote": None,
                "principle_codes": ["BL-AD", "BL-INVALID", "FAKE-CODE"],
                "confidence": 0.7,
                "applications": {"business": "Test"},
                "reasoning": "Test",
            }
        )

        mock_llm = AsyncMock()
        mock_llm.chat = AsyncMock(return_value=mock_response)

        result = await extract_wisdom_from_scene(
            scene_data={"start_time": 0, "end_time": 5},
            actions=[{"action_type": "verbal"}],
            transcript_text="Test",
            llm_client=mock_llm,
        )

        assert result is not None
        assert "BL-INVALID" not in result.principle_codes
        assert "FAKE-CODE" not in result.principle_codes
        assert "BL-AD" in result.principle_codes

    async def test_handles_json_parse_error(self):
        mock_llm = AsyncMock()
        mock_llm.chat = AsyncMock(return_value="not valid json {{{")

        result = await extract_wisdom_from_scene(
            scene_data={"start_time": 0, "end_time": 5},
            actions=[{"action_type": "verbal"}],
            transcript_text="Test text",
            llm_client=mock_llm,
        )

        assert result is None

    async def test_confidence_clamped_to_valid_range(self):
        mock_response = json.dumps(
            {
                "title": "Test",
                "intent": "Test",
                "insight_text": "Test",
                "evidence_quote": None,
                "principle_codes": ["BL-AD"],
                "confidence": 1.5,  # Out of range
                "applications": {},
                "reasoning": "",
            }
        )

        mock_llm = AsyncMock()
        mock_llm.chat = AsyncMock(return_value=mock_response)

        result = await extract_wisdom_from_scene(
            scene_data={"start_time": 0, "end_time": 5},
            actions=[{"action_type": "verbal"}],
            transcript_text="Test",
            llm_client=mock_llm,
        )

        assert result is not None
        assert 0.0 <= result.confidence <= 1.0
