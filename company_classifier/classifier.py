"""
Hybrid Company Classifier
Combines keyword rules (fast, high-precision) with HuggingFace zero-shot
classification (facebook/bart-large-mnli) for ambiguous cases.
"""

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .pipeline import Company

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Keyword banks
# ---------------------------------------------------------------------------

_RECRUITMENT_KEYWORDS = [
    "staffing", "recruiting", "recruitment", "recruiter",
    "talent acquisition", "talent sourcing", "executive search",
    "talent solutions", "manpower", "workforce solutions",
    "placing candidates", "hiring for clients", "recruitment partner",
    "staffing solutions", "headhunting", "contingency search",
    "contract staffing", "temporary staffing", "permanent placement",
    "retained search", "job placement", "staff augmentation",
    "contract-to-hire", "direct hire", "candidate placement",
    "hire on behalf", "staffing firm", "staffing agency",
]

_PRODUCT_KEYWORDS = [
    "saas", "software as a service", "our platform", "our product",
    "our app", "cloud platform", "developer tools", "mobile app",
    "web application", "software solution", "technology platform",
    "product-led", "subscription software", "engineering team",
    "product roadmap", "open source", "api-first", "self-serve",
    "no-code", "low-code", "marketplace platform",
]

_SERVICE_KEYWORDS = [
    "consulting", "consultancy", "professional services",
    "managed services", "outsourcing", "implementation services",
    "systems integrator", "advisory", "digital transformation",
    "it services", "bpo", "business process outsourcing",
    "technology consulting", "it consulting",
]

# Company name substrings that strongly imply recruitment
_RECRUITMENT_NAME_SIGNALS = [
    "staffing", "recruit", "manpower", "workforce", "placements",
    "talent group", "talent solutions", "hire", "headhunt",
    "personnel", "search group",
]


@dataclass
class ClassificationScore:
    label: str
    confidence: float
    reason: str
    method: str


# ---------------------------------------------------------------------------
# Keyword rule classifier
# ---------------------------------------------------------------------------

class KeywordClassifier:
    def classify(self, text: str) -> ClassificationScore:
        t = text.lower()

        rec_hits = [k for k in _RECRUITMENT_KEYWORDS if k in t]
        prod_hits = [k for k in _PRODUCT_KEYWORDS if k in t]
        svc_hits = [k for k in _SERVICE_KEYWORDS if k in t]

        rec_score = len(rec_hits)
        prod_score = len(prod_hits)
        svc_score = len(svc_hits)
        total = rec_score + prod_score + svc_score

        if total == 0:
            return ClassificationScore("Unknown", 0.0, "No keyword matches", "keyword")

        def conf(hits: int) -> float:
            return min(0.95, 0.55 + hits * 0.08)

        if rec_score > prod_score and rec_score > svc_score:
            return ClassificationScore(
                "Recruitment Company", conf(rec_score),
                f"Matched recruitment keywords: {rec_hits[:4]}", "keyword"
            )
        if prod_score > svc_score:
            return ClassificationScore(
                "Product Company", conf(prod_score),
                f"Matched product keywords: {prod_hits[:4]}", "keyword"
            )
        return ClassificationScore(
            "Service Company", conf(svc_score),
            f"Matched service keywords: {svc_hits[:4]}", "keyword"
        )


# ---------------------------------------------------------------------------
# HuggingFace zero-shot classifier (lazy-loaded)
# ---------------------------------------------------------------------------

class HuggingFaceClassifier:
    MODEL = "facebook/bart-large-mnli"
    LABELS = ["Product Company", "Recruitment Company", "Service Company"]

    def __init__(self):
        self._pipe = None
        self._available = None  # None = untested

    def _load(self) -> bool:
        if self._available is True:
            return True
        if self._available is False:
            return False
        try:
            from transformers import pipeline
            self._pipe = pipeline(
                "zero-shot-classification",
                model=self.MODEL,
            )
            self._available = True
            logger.info(f"Loaded HuggingFace model: {self.MODEL}")
        except Exception as e:
            logger.warning(f"HuggingFace model unavailable ({e}). Skipping.")
            self._available = False
        return self._available

    def classify(self, text: str) -> ClassificationScore:
        if not self._load():
            return ClassificationScore("Unknown", 0.0, "HF model not available", "hf_classifier")
        try:
            result = self._pipe(text[:512], candidate_labels=self.LABELS)
            label = result["labels"][0]
            confidence = float(result["scores"][0])
            return ClassificationScore(
                label, confidence,
                f"HuggingFace {self.MODEL}: top score {confidence:.2f}",
                "hf_classifier"
            )
        except Exception as e:
            logger.error(f"HF classification error: {e}")
            return ClassificationScore("Unknown", 0.0, str(e), "hf_classifier")


# ---------------------------------------------------------------------------
# Hybrid classifier: rules first, HF as fallback
# ---------------------------------------------------------------------------

class HybridClassifier:
    """
    Decision order:
      1. Company name contains strong recruitment signal  → Recruitment (0.9)
      2. Keyword rules with confidence ≥ 0.70            → return immediately
      3. HuggingFace zero-shot classification            → take if better
      4. Best available result
    """

    def __init__(self, use_hf: bool = True):
        self._keyword = KeywordClassifier()
        self._hf = HuggingFaceClassifier() if use_hf else None

    def _build_text(self, company: "Company") -> str:
        parts = [
            company.name,
            company.industry,
            company.description,
            company.extra.get("web_keywords", ""),
            company.extra.get("url_signals", []),
        ]
        flat = []
        for p in parts:
            if isinstance(p, list):
                flat.extend(p)
            elif isinstance(p, str) and p:
                flat.append(p)
        return " ".join(flat)

    def classify(self, company: "Company") -> ClassificationScore:
        text = self._build_text(company)

        if not text.strip():
            return ClassificationScore("Unknown", 0.0, "No company data available", "keyword")

        # Fast path: company name alone betrays recruitment nature
        name_lower = company.name.lower()
        if any(sig in name_lower for sig in _RECRUITMENT_NAME_SIGNALS):
            return ClassificationScore(
                "Recruitment Company", 0.9,
                f"Company name contains recruitment signal", "keyword"
            )

        kw = self._keyword.classify(text)

        if kw.confidence >= 0.70:
            return kw

        if self._hf:
            hf = self._hf.classify(text)
            if hf.label != "Unknown" and hf.confidence > kw.confidence:
                return hf

        if kw.label != "Unknown":
            return kw

        return ClassificationScore("Unknown", 0.25, "Low confidence from all methods", "keyword")
