"""
GitHub Agent Orchestrator
Uses the OpenAI Agents SDK (openai-agents) or falls back to the Anthropic client
to provide LLM reasoning for ambiguous company classifications.

Primary backend: openai-agents SDK  (pip install openai-agents)
Fallback backend: anthropic SDK     (pip install anthropic)
"""

import json
import logging
from dataclasses import dataclass
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .pipeline import Company

logger = logging.getLogger(__name__)

_AGENT_INSTRUCTIONS = """
You are a company classification expert. Given company information, determine
whether the company is a:

1. Product Company   — builds and sells software, SaaS, hardware, or digital
                       products; has its own engineering/product teams; revenue
                       comes from products, not from placing people.
2. Recruitment Company — earns revenue by placing candidates at client companies;
                         operates as a staffing, recruiting, or talent acquisition firm.
3. Service Company   — provides consulting, IT services, professional services,
                       outsourcing, or system integration but does NOT sell its
                       own software product.

Return ONLY valid JSON with no extra text:
{
  "label": "Product Company" | "Recruitment Company" | "Service Company" | "Unknown",
  "confidence": 0.0-1.0,
  "reason": "one-sentence explanation"
}
"""

_VALID_LABELS = {"Product Company", "Recruitment Company", "Service Company", "Unknown"}


@dataclass
class AgentClassificationScore:
    label: str
    confidence: float
    reason: str
    method: str = "agent"


class CompanyClassifierAgent:
    """
    Wraps either the OpenAI Agents SDK or the Anthropic client to provide
    LLM-powered company classification as a fallback for uncertain cases.
    """

    def __init__(self, model: str = "claude-sonnet-4-6"):
        self.model = model
        self._backend: Optional[str] = None
        self._client = None
        self._agents_sdk = None
        self._init_backend()

    # ------------------------------------------------------------------
    # Backend detection (try Agents SDK first, then Anthropic)
    # ------------------------------------------------------------------

    def _init_backend(self) -> None:
        try:
            from agents import Agent, Runner  # noqa: F401 — probing import
            self._agents_sdk = True
            self._backend = "openai-agents"
            logger.info("Agent backend: OpenAI Agents SDK")
            return
        except ImportError:
            pass

        try:
            import anthropic
            self._client = anthropic.Anthropic()
            self._backend = "anthropic"
            logger.info("Agent backend: Anthropic client")
            return
        except ImportError:
            pass

        logger.warning(
            "No AI agent backend found. "
            "Install 'openai-agents' or 'anthropic' to enable agent classification."
        )
        self._backend = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def classify(self, company: "Company") -> AgentClassificationScore:
        if self._backend == "openai-agents":
            return self._classify_agents_sdk(company)
        if self._backend == "anthropic":
            return self._classify_anthropic(company)
        return AgentClassificationScore(
            "Unknown", 0.0, "No AI backend configured", "agent"
        )

    # ------------------------------------------------------------------
    # Backend implementations
    # ------------------------------------------------------------------

    def _build_prompt(self, company: "Company") -> str:
        lines = [f"Company: {company.name}"]
        if company.industry:
            lines.append(f"Industry: {company.industry}")
        if company.description:
            lines.append(f"Description: {company.description[:600]}")
        if company.website:
            lines.append(f"Website: {company.website}")
        return "\n".join(lines)

    def _parse_response(self, raw: str) -> AgentClassificationScore:
        try:
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(raw[start:end])
                label = data.get("label", "Unknown")
                if label not in _VALID_LABELS:
                    label = "Unknown"
                return AgentClassificationScore(
                    label=label,
                    confidence=min(1.0, max(0.0, float(data.get("confidence", 0.5)))),
                    reason=str(data.get("reason", "")),
                )
        except (json.JSONDecodeError, TypeError, ValueError) as e:
            logger.debug(f"Agent response parse error: {e} — raw: {raw[:200]}")
        return AgentClassificationScore("Unknown", 0.3, "Could not parse agent response")

    def _classify_anthropic(self, company: "Company") -> AgentClassificationScore:
        prompt = self._build_prompt(company)
        try:
            message = self._client.messages.create(
                model=self.model,
                max_tokens=256,
                messages=[
                    {
                        "role": "user",
                        "content": f"{_AGENT_INSTRUCTIONS}\n\n{prompt}",
                    }
                ],
            )
            return self._parse_response(message.content[0].text)
        except Exception as e:
            logger.error(f"Anthropic agent error: {e}")
            return AgentClassificationScore("Unknown", 0.0, str(e))

    def _classify_agents_sdk(self, company: "Company") -> AgentClassificationScore:
        from agents import Agent, Runner

        agent = Agent(
            name="CompanyClassifier",
            instructions=_AGENT_INSTRUCTIONS,
            model=self.model,
        )
        prompt = self._build_prompt(company)
        try:
            result = Runner.run_sync(agent, prompt)
            return self._parse_response(result.final_output)
        except Exception as e:
            logger.error(f"Agents SDK error: {e}")
            return AgentClassificationScore("Unknown", 0.0, str(e))
