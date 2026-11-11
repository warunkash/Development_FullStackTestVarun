"""
Company Enrichment Agent
Fetches website metadata to supplement sparse LinkedIn data.
Falls back gracefully when network is unavailable.
"""

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .pipeline import Company

logger = logging.getLogger(__name__)

_REQUESTS_AVAILABLE = False
_BS4_AVAILABLE = False

try:
    import requests
    _REQUESTS_AVAILABLE = True
except ImportError:
    pass

try:
    from bs4 import BeautifulSoup
    _BS4_AVAILABLE = True
except ImportError:
    pass

_FETCH_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# Keywords in URLs that signal recruitment nature
_RECRUITMENT_URL_SIGNALS = [
    "staffing", "recruiting", "recruitment", "talent", "manpower",
    "workforce", "headhunt", "placement", "staffco", "hireflex",
]


class CompanyEnrichment:
    def __init__(self, timeout: int = 6):
        self._timeout = timeout
        if not _REQUESTS_AVAILABLE:
            logger.warning("'requests' not installed — web enrichment disabled.")
        if not _BS4_AVAILABLE:
            logger.warning("'beautifulsoup4' not installed — HTML parsing disabled.")

    def enrich(self, company: "Company") -> "Company":
        """Return the company object with description/industry filled in where missing."""
        # Check URL itself for recruitment signals before fetching
        if company.website:
            url_lower = company.website.lower()
            if any(sig in url_lower for sig in _RECRUITMENT_URL_SIGNALS):
                company.extra.setdefault("url_signals", [])
                company.extra["url_signals"] += [
                    s for s in _RECRUITMENT_URL_SIGNALS if s in url_lower
                ]

        # Skip fetch if we already have useful data
        if company.description and company.industry:
            return company

        if company.website and _REQUESTS_AVAILABLE:
            try:
                meta = self._fetch_website_meta(company.website)
                if meta.get("description") and not company.description:
                    company.description = meta["description"]
                if meta.get("keywords"):
                    existing = company.extra.get("web_keywords", "")
                    company.extra["web_keywords"] = (
                        existing + " " + meta["keywords"]
                    ).strip()
            except Exception as e:
                logger.debug(f"Enrichment skipped for '{company.name}': {e}")

        return company

    def _fetch_website_meta(self, url: str) -> dict:
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        resp = requests.get(
            url, timeout=self._timeout, headers=_FETCH_HEADERS, allow_redirects=True
        )
        resp.raise_for_status()

        if not _BS4_AVAILABLE:
            return {}

        soup = BeautifulSoup(resp.text, "html.parser")
        description = _extract_meta(soup, "description")
        og_description = _extract_og(soup, "og:description")
        keywords = _extract_meta(soup, "keywords")

        # Best-effort description fallback: title + first visible paragraph
        if not description and not og_description:
            title = soup.title.string.strip() if soup.title else ""
            first_p = soup.find("p")
            first_p_text = first_p.get_text(" ", strip=True) if first_p else ""
            description = f"{title} {first_p_text}".strip()

        return {
            "description": (description or og_description or "")[:1200],
            "keywords": (keywords or "")[:300],
        }


def _extract_meta(soup, name: str) -> str:
    tag = soup.find("meta", attrs={"name": name})
    return (tag.get("content") or "") if tag else ""


def _extract_og(soup, property_name: str) -> str:
    tag = soup.find("meta", property=property_name)
    return (tag.get("content") or "") if tag else ""
