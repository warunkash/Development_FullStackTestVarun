"""
Company Classification Pipeline
Main orchestrator: cache → enrichment → keyword rules → HF classifier → agent.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

from .cache import CompanyCache
from .classifier import HybridClassifier, ClassificationScore
from .enrichment import CompanyEnrichment

logger = logging.getLogger(__name__)

LABELS = ("Product Company", "Recruitment Company", "Service Company", "Unknown")


@dataclass
class Company:
    name: str
    description: str = ""
    website: str = ""
    industry: str = ""
    employee_count: Optional[int] = None
    linkedin_url: str = ""
    extra: dict = field(default_factory=dict)


@dataclass
class ClassificationResult:
    company: Company
    label: str
    confidence: float
    reason: str
    method: str

    def is_product(self) -> bool:
        return self.label == "Product Company"

    def is_recruitment(self) -> bool:
        return self.label == "Recruitment Company"

    def __str__(self) -> str:
        icon = {"Product Company": "✓", "Recruitment Company": "✗", "Service Company": "?"}.get(
            self.label, "~"
        )
        return (
            f"{icon} {self.company.name:<30} [{self.label}] "
            f"(confidence={self.confidence:.0%}, via={self.method})"
        )


class CompanyClassificationPipeline:
    """
    Two-stage pipeline:
      Stage 1 — Company Enrichment Agent: fills in description/industry/web metadata.
      Stage 2 — Hybrid Classifier: keyword rules → HF zero-shot → (optional) LLM agent.

    Decision priority:
      1. Company knowledge cache           — instant, 100% confidence
      2. Keyword rule classifier           — fast, high-precision
      3. HuggingFace bart-large-mnli       — zero-shot NLI
      4. GitHub Agent (LLM) orchestrator   — reasoning fallback for ambiguous cases

    Results with confidence ≥ 0.80 are written back to the cache.
    """

    def __init__(
        self,
        cache_path: Optional[str] = None,
        use_hf: bool = True,
        use_agent: bool = False,
        agent_confidence_threshold: float = 0.60,
    ):
        self._cache = CompanyCache(cache_path)
        self._enrichment = CompanyEnrichment()
        self._classifier = HybridClassifier(use_hf=use_hf)
        self._use_agent = use_agent
        self._agent_threshold = agent_confidence_threshold
        self._agent = None

        if use_agent:
            from .agents_orchestrator import CompanyClassifierAgent
            self._agent = CompanyClassifierAgent()

    # ------------------------------------------------------------------
    # Single-company classification
    # ------------------------------------------------------------------

    def classify(self, company: Company) -> ClassificationResult:
        # Stage 0: cache hit
        cached_label = self._cache.lookup(company.name)
        if cached_label:
            return ClassificationResult(
                company=company,
                label=cached_label,
                confidence=1.0,
                reason="Found in company knowledge cache",
                method="cache",
            )

        # Stage 1: enrich
        company = self._enrichment.enrich(company)

        # Stage 2: hybrid classifier (keyword + HF)
        score: ClassificationScore = self._classifier.classify(company)

        # Stage 3: agent fallback for uncertain cases
        if self._agent and score.confidence < self._agent_threshold:
            agent_score = self._agent.classify(company)
            if agent_score.label != "Unknown" and agent_score.confidence > score.confidence:
                score = ClassificationScore(
                    label=agent_score.label,
                    confidence=agent_score.confidence,
                    reason=agent_score.reason,
                    method=agent_score.method,
                )
                logger.debug(
                    f"Agent override for '{company.name}': {score.label} ({score.confidence:.0%})"
                )

        result = ClassificationResult(
            company=company,
            label=score.label,
            confidence=score.confidence,
            reason=score.reason,
            method=score.method,
        )

        # Write confident results back to cache
        if score.confidence >= 0.80 and score.label != "Unknown":
            self._cache.store(company.name, score.label)

        return result

    # ------------------------------------------------------------------
    # Batch processing
    # ------------------------------------------------------------------

    def process_batch(
        self, companies: list[Company]
    ) -> dict[str, list[ClassificationResult]]:
        buckets: dict[str, list[ClassificationResult]] = {label: [] for label in LABELS}
        for company in companies:
            result = self.classify(company)
            buckets[result.label].append(result)
        return buckets

    def process_linkedin_jobs(
        self, job_listings: list[dict]
    ) -> dict[str, list[ClassificationResult]]:
        """
        Accept a list of LinkedIn job dicts with keys:
          company_name, company_description, company_website,
          industry, company_linkedin_url  (all optional except company_name)
        """
        seen: set[str] = set()
        companies: list[Company] = []
        for job in job_listings:
            name = (job.get("company_name") or "").strip()
            if not name or name in seen:
                continue
            seen.add(name)
            companies.append(
                Company(
                    name=name,
                    description=job.get("company_description", ""),
                    website=job.get("company_website", ""),
                    industry=job.get("industry", ""),
                    linkedin_url=job.get("company_linkedin_url", ""),
                )
            )
        return self.process_batch(companies)

    def get_product_companies(self, job_listings: list[dict]) -> list[str]:
        """Convenience: return only product company names from job listings."""
        results = self.process_linkedin_jobs(job_listings)
        return [r.company.name for r in results["Product Company"]]

    def filter_out_recruitment(self, job_listings: list[dict]) -> list[dict]:
        """Return job listings with recruitment/staffing companies removed."""
        results = self.process_linkedin_jobs(job_listings)
        recruitment_names = {
            r.company.name for r in results["Recruitment Company"]
        }
        return [j for j in job_listings if j.get("company_name") not in recruitment_names]

    def save_cache(self) -> None:
        self._cache.save()

    # ------------------------------------------------------------------
    # Pretty-print summary
    # ------------------------------------------------------------------

    def print_summary(self, buckets: dict[str, list[ClassificationResult]]) -> None:
        print("\n" + "=" * 60)
        print("  Company Classification Results")
        print("=" * 60)

        product = buckets.get("Product Company", [])
        recruitment = buckets.get("Recruitment Company", [])
        service = buckets.get("Service Company", [])
        unknown = buckets.get("Unknown", [])

        if product:
            print(f"\n✓ Product Companies ({len(product)})")
            for r in product:
                print(f"  {r.company.name}")

        if recruitment:
            print(f"\n✗ Recruitment / Staffing ({len(recruitment)})")
            for r in recruitment:
                print(f"  {r.company.name}  — {r.reason[:60]}")

        if service:
            print(f"\n? Service / Consulting ({len(service)})")
            for r in service:
                print(f"  {r.company.name}")

        if unknown:
            print(f"\n~ Unknown ({len(unknown)})")
            for r in unknown:
                print(f"  {r.company.name}  (confidence={r.confidence:.0%})")

        total = sum(len(v) for v in buckets.values())
        print(f"\nTotal processed: {total}")
        print("=" * 60 + "\n")
