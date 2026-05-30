"""
Wisdom extraction pipeline — the core IP of MentorOS.

Converts: Action + Context + Transcript → Intent → Principle → Wisdom → Applications
"""

import json
import logging
from dataclasses import dataclass, field
from typing import Any

log = logging.getLogger(__name__)


@dataclass
class ExtractedWisdom:
    title: str
    insight_text: str
    evidence_quote: str | None
    start_time: float
    end_time: float
    confidence: float
    principle_codes: list[str]
    applications: dict[str, str]  # domain → application text
    intent: str
    reasoning: str


WISDOM_SYSTEM_PROMPT = """You are an expert analyst of Bruce Lee's philosophy, martial arts, and life wisdom.

You have deep knowledge of Bruce Lee's taxonomy of principles:
- BL-AD (Adaptability): Formlessness; adjusting to any situation
- BL-FL (Flow): Water-like movement; continuous natural motion
- BL-TM (Timing): Perfect moment selection for action
- BL-IN (Interception): Attacking the attack; meeting force before it arrives
- BL-EF (Efficiency): Economy of motion; maximum impact with minimum effort
- BL-DR (Directness): Straight path to the target; no wasted movement
- BL-AW (Awareness): Peripheral vision; reading the complete environment
- BL-PO (Positioning): Strategic placement before action
- BL-SI (Simplicity): Eliminating the non-essential
- BL-NR (Non-Resistance): Yielding to redirect force
- BL-PR (Presence): Complete focus; eliminating mental noise
- BL-SE (Self-Expression): Authentic action; being genuinely oneself
- BL-EC (Emotional Control): Harnessing emotion without being controlled by it
- BL-CG (Continuous Growth): Daily self-improvement; absorb what is useful
- BL-DT (Detachment): Non-attachment to outcomes while committed to process

Your analysis must be:
1. Grounded in the provided evidence (never fabricate)
2. Specific to what is observed (not generic)
3. Cross-domain applicable (business, investing, leadership, relationships, personal growth)
4. Honest about confidence levels

Always respond in the exact JSON format specified."""


WISDOM_EXTRACTION_TEMPLATE = """Analyze this observed moment from Bruce Lee:

VIDEO CONTEXT:
- Scene type: {scene_type}
- Time: {start_time:.1f}s - {end_time:.1f}s
- Environment: {environment}

OBSERVED ACTIONS:
{actions_description}

TRANSCRIPT (spoken words during this moment):
"{transcript_text}"

POSE/MOVEMENT DATA:
- Movement intensity: {movement_intensity:.2f} (0=still, 1=maximum)
- Dominant movement: {dominant_movement}
- Body posture features: {posture_features}

Analyze this moment and extract wisdom. Be specific to what is ACTUALLY observed.

Respond in this exact JSON format:
{{
  "title": "Brief descriptive title (max 80 chars)",
  "intent": "What Bruce Lee's underlying intent/purpose appears to be",
  "insight_text": "The core wisdom insight (2-3 sentences, specific to evidence)",
  "evidence_quote": "Direct quote from transcript supporting this, or null",
  "principle_codes": ["BL-XX", "BL-YY"],
  "confidence": 0.0,
  "applications": {{
    "business": "How this applies to business (1 sentence)",
    "investing": "How this applies to investing (1 sentence)",
    "leadership": "How this applies to leadership (1 sentence)",
    "relationships": "How this applies to relationships (1 sentence)",
    "personal_growth": "How this applies to personal development (1 sentence)"
  }},
  "reasoning": "Brief reasoning for principle mapping"
}}"""


async def extract_wisdom_from_scene(
    scene_data: dict[str, Any],
    actions: list[dict],
    transcript_text: str,
    llm_client: Any,
    model: str = "Qwen/Qwen2.5-72B-Instruct",
) -> ExtractedWisdom | None:
    """Extract wisdom from a single scene using LLM analysis."""
    if not (actions or transcript_text):
        return None

    actions_description = _format_actions(actions)
    movement_data = _summarize_movement(actions)

    prompt = WISDOM_EXTRACTION_TEMPLATE.format(
        scene_type=scene_data.get("scene_type", "unknown"),
        start_time=scene_data.get("start_time", 0),
        end_time=scene_data.get("end_time", 0),
        environment=scene_data.get("environment", "unknown"),
        actions_description=actions_description,
        transcript_text=transcript_text or "(no speech in this segment)",
        movement_intensity=movement_data["intensity"],
        dominant_movement=movement_data["dominant"],
        posture_features=json.dumps(movement_data["posture"]),
    )

    try:
        response = await llm_client.chat(
            model=model,
            system=WISDOM_SYSTEM_PROMPT,
            message=prompt,
            temperature=0.3,
            max_tokens=1024,
            response_format={"type": "json_object"},
        )

        data = json.loads(response)

        # Validate required fields
        required = ["title", "insight_text", "principle_codes", "confidence", "applications"]
        for field_name in required:
            if field_name not in data:
                log.warning("LLM response missing field: %s", field_name)
                return None

        # Clamp confidence
        data["confidence"] = max(0.0, min(1.0, float(data.get("confidence", 0.5))))

        # Filter invalid principle codes
        valid_codes = {
            "BL-AD", "BL-FL", "BL-TM", "BL-IN", "BL-EF", "BL-DR",
            "BL-AW", "BL-PO", "BL-SI", "BL-NR", "BL-PR",
            "BL-SE", "BL-EC", "BL-CG", "BL-DT",
        }
        data["principle_codes"] = [c for c in data.get("principle_codes", []) if c in valid_codes]

        if not data["principle_codes"]:
            log.warning("No valid principle codes extracted")
            data["confidence"] = min(data["confidence"], 0.3)

        return ExtractedWisdom(
            title=data["title"],
            insight_text=data["insight_text"],
            evidence_quote=data.get("evidence_quote"),
            start_time=scene_data.get("start_time", 0),
            end_time=scene_data.get("end_time", 0),
            confidence=data["confidence"],
            principle_codes=data["principle_codes"],
            applications=data.get("applications", {}),
            intent=data.get("intent", ""),
            reasoning=data.get("reasoning", ""),
        )

    except (json.JSONDecodeError, KeyError) as e:
        log.error("Failed to parse LLM wisdom response: %s", e)
        return None


CROSS_DOMAIN_TEMPLATE = """Given this wisdom insight from Bruce Lee:

INSIGHT: {insight_text}
PRINCIPLE: {principle_name} — {principle_definition}
CONTEXT: {evidence_quote}

Generate a comprehensive cross-domain application guide.

Respond in JSON format:
{{
  "business": {{
    "application": "How this principle applies to business",
    "example": "Specific business example",
    "action_steps": ["step 1", "step 2", "step 3"]
  }},
  "investing": {{
    "application": "How this applies to investing",
    "example": "Specific investing example",
    "action_steps": ["step 1", "step 2"]
  }},
  "leadership": {{
    "application": "How this applies to leadership",
    "example": "Specific leadership example",
    "action_steps": ["step 1", "step 2"]
  }},
  "relationships": {{
    "application": "How this applies to relationships",
    "example": "Specific relationship example",
    "action_steps": ["step 1", "step 2"]
  }},
  "personal_growth": {{
    "application": "How this applies to personal development",
    "example": "Specific personal growth example",
    "action_steps": ["step 1", "step 2"]
  }}
}}"""


async def generate_cross_domain_applications(
    insight: ExtractedWisdom,
    principles: list[dict],
    llm_client: Any,
    model: str = "Qwen/Qwen2.5-72B-Instruct",
) -> dict[str, dict]:
    """Generate detailed cross-domain applications for a wisdom insight."""
    if not insight.principle_codes:
        return {}

    primary_principle = next(
        (p for p in principles if p["code"] == insight.principle_codes[0]),
        {"name": "Wisdom", "definition": "Universal principle"}
    )

    prompt = CROSS_DOMAIN_TEMPLATE.format(
        insight_text=insight.insight_text,
        principle_name=primary_principle.get("name", ""),
        principle_definition=primary_principle.get("definition", ""),
        evidence_quote=insight.evidence_quote or "Observable action",
    )

    try:
        response = await llm_client.chat(
            model=model,
            system="You are an expert at translating ancient wisdom into modern practical applications.",
            message=prompt,
            temperature=0.4,
            max_tokens=1500,
            response_format={"type": "json_object"},
        )
        return json.loads(response)
    except Exception as e:
        log.error("Cross-domain generation failed: %s", e)
        return {}


def _format_actions(actions: list[dict]) -> str:
    if not actions:
        return "No discrete actions detected"
    lines = []
    for a in actions:
        line = f"- [{a.get('start_time', 0):.1f}s-{a.get('end_time', 0):.1f}s] {a.get('action_type', '?')}"
        if a.get("action_subtype"):
            line += f" ({a['action_subtype']})"
        if a.get("intensity"):
            line += f" intensity={a['intensity']:.2f}"
        lines.append(line)
    return "\n".join(lines)


def _summarize_movement(actions: list[dict]) -> dict:
    if not actions:
        return {"intensity": 0.0, "dominant": "none", "posture": {}}

    intensities = [a.get("intensity", 0.0) for a in actions]
    avg_intensity = sum(intensities) / max(len(intensities), 1)

    action_types = [a.get("action_type", "unknown") for a in actions]
    dominant = max(set(action_types), key=action_types.count) if action_types else "unknown"

    all_posture = {}
    for a in actions:
        if a.get("pose_analysis", {}).get("posture_features"):
            all_posture.update(a["pose_analysis"]["posture_features"])

    return {"intensity": avg_intensity, "dominant": dominant, "posture": all_posture}
