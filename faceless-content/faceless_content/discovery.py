"""Topic discovery: find what people are actually viewing right now.

Each source contributes candidates with a raw popularity metric (pageviews,
search volume, upvotes). Metrics are not comparable across sources, so each
source is normalised against its own maximum before being weighted and merged.
A topic that several independent sources agree on is boosted, because
cross-source agreement is the strongest available signal that something is
genuinely being looked at rather than being amplified by one platform.
"""

from __future__ import annotations

import html
import logging
import os
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import requests

from .config import DiscoveryConfig
from .errors import DiscoveryError
from .safety import screen
from .state import State, topic_key

logger = logging.getLogger(__name__)

USER_AGENT = "faceless-content/0.1 (+https://github.com/warunkash/Development_FullStackTestVarun)"

_TRAFFIC = re.compile(r"[\d,]+")


@dataclass
class RawCandidate:
    """One topic as a single source reported it."""

    title: str
    metric: float
    source: str
    url: str = ""
    summary: str = ""


@dataclass
class Topic:
    """A merged, scored, screened topic ready to be scripted."""

    title: str
    score: float
    sources: list[str] = field(default_factory=list)
    url: str = ""
    summary: str = ""

    @property
    def key(self) -> str:
        return topic_key(self.title)


def _get_json(session: requests.Session, url: str, timeout: float, **kwargs):
    response = session.get(url, timeout=timeout, **kwargs)
    response.raise_for_status()
    return response.json()


def fetch_wikipedia(session: requests.Session, cfg: DiscoveryConfig) -> list[RawCandidate]:
    """Yesterday's most-read English Wikipedia articles, by actual pageviews.

    Anonymous callers share a low rate limit per IP, which shared/cloud runners
    hit easily. Set WIKIMEDIA_ACCESS_TOKEN to get the authenticated allowance.
    """
    # Today's feed is only assembled after the day closes, so read the last full day.
    day = datetime.now(timezone.utc) - timedelta(days=1)
    url = (
        "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/"
        f"{day.year}/{day.month:02d}/{day.day:02d}"
    )
    headers = {}
    token = os.environ.get("WIKIMEDIA_ACCESS_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    payload = _get_json(session, url, cfg.request_timeout, headers=headers)
    candidates = []
    for article in (payload.get("mostread") or {}).get("articles", []):
        titles = article.get("titles") or {}
        title = titles.get("normalized") or article.get("title", "")
        title = title.replace("_", " ").strip()
        if not title or title.lower() in {"main page", "special:search"}:
            continue
        candidates.append(
            RawCandidate(
                title=title,
                metric=float(article.get("views", 0)),
                source="wikipedia",
                url=((article.get("content_urls") or {}).get("desktop") or {}).get("page", ""),
                summary=article.get("extract", "") or "",
            )
        )
    return candidates[: cfg.candidates_per_source]


def fetch_google_trends(session: requests.Session, cfg: DiscoveryConfig) -> list[RawCandidate]:
    """Google's trending-now RSS feed, scored by approximate search traffic."""
    url = f"https://trends.google.com/trending/rss?geo={cfg.geo}"
    response = session.get(url, timeout=cfg.request_timeout)
    response.raise_for_status()
    return parse_google_trends_rss(response.text)[: cfg.candidates_per_source]


def parse_google_trends_rss(xml_text: str) -> list[RawCandidate]:
    """Parse the trending RSS payload into candidates (split out so it is testable)."""
    namespace = {"ht": "https://trends.google.com/trending/rss"}
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        raise DiscoveryError(f"malformed Google Trends RSS: {exc}") from exc

    candidates = []
    for item in root.iterfind(".//item"):
        title = (item.findtext("title") or "").strip()
        if not title:
            continue
        traffic_text = item.findtext("ht:approx_traffic", default="", namespaces=namespace)
        match = _TRAFFIC.search(traffic_text or "")
        metric = float(match.group(0).replace(",", "")) if match else 1000.0
        news = item.find("ht:news_item", namespace)
        summary = ""
        if news is not None:
            summary = html.unescape(
                (news.findtext("ht:news_item_title", default="", namespaces=namespace) or "").strip()
            )
        candidates.append(
            RawCandidate(
                title=title,
                metric=metric,
                source="google_trends",
                url=item.findtext("link") or "",
                summary=summary,
            )
        )
    return candidates


def fetch_reddit(session: requests.Session, cfg: DiscoveryConfig) -> list[RawCandidate]:
    """Top posts of the day from the configured subreddits, scored by upvotes."""
    per_sub = max(1, cfg.candidates_per_source // max(1, len(cfg.subreddits)))
    candidates = []
    for subreddit in cfg.subreddits:
        url = f"https://www.reddit.com/r/{subreddit}/top.json"
        try:
            payload = _get_json(
                session,
                url,
                cfg.request_timeout,
                params={"t": "day", "limit": per_sub},
            )
        except (requests.RequestException, ValueError) as exc:
            logger.warning("reddit r/%s unavailable: %s", subreddit, exc)
            continue
        for child in (payload.get("data") or {}).get("children", []):
            data = child.get("data") or {}
            title = (data.get("title") or "").strip()
            if not title or data.get("over_18"):
                continue
            candidates.append(
                RawCandidate(
                    title=title,
                    metric=float(data.get("score", 0)),
                    source="reddit",
                    url="https://www.reddit.com" + data.get("permalink", ""),
                    summary=(data.get("selftext") or "")[:600],
                )
            )
    return candidates


def fetch_hacker_news(session: requests.Session, cfg: DiscoveryConfig) -> list[RawCandidate]:
    """Hacker News front page, scored by points."""
    payload = _get_json(
        session,
        "https://hn.algolia.com/api/v1/search",
        cfg.request_timeout,
        params={"tags": "front_page", "hitsPerPage": cfg.candidates_per_source},
    )
    candidates = []
    for hit in payload.get("hits", []):
        title = (hit.get("title") or "").strip()
        if not title:
            continue
        candidates.append(
            RawCandidate(
                title=title,
                metric=float(hit.get("points") or 0),
                source="hacker_news",
                url=hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID')}",
            )
        )
    return candidates


def fetch_youtube(session: requests.Session, cfg: DiscoveryConfig) -> list[RawCandidate]:
    """YouTube's most-popular chart, scored by literal view count."""
    if not cfg.youtube_api_key:
        logger.info("youtube source skipped: no API key configured")
        return []
    payload = _get_json(
        session,
        "https://www.googleapis.com/youtube/v3/videos",
        cfg.request_timeout,
        params={
            "part": "snippet,statistics",
            "chart": "mostPopular",
            "regionCode": cfg.geo,
            "maxResults": min(50, cfg.candidates_per_source),
            "key": cfg.youtube_api_key,
        },
    )
    candidates = []
    for item in payload.get("items", []):
        snippet = item.get("snippet") or {}
        title = (snippet.get("title") or "").strip()
        if not title:
            continue
        views = float((item.get("statistics") or {}).get("viewCount") or 0)
        candidates.append(
            RawCandidate(
                title=title,
                metric=views,
                source="youtube",
                url=f"https://www.youtube.com/watch?v={item.get('id')}",
                summary=(snippet.get("description") or "")[:600],
            )
        )
    return candidates


SOURCES = {
    "wikipedia": fetch_wikipedia,
    "google_trends": fetch_google_trends,
    "reddit": fetch_reddit,
    "hacker_news": fetch_hacker_news,
    "youtube": fetch_youtube,
}


def normalise(candidates: list[RawCandidate]) -> dict[str, float]:
    """Scale one source's metrics into 0..1 against that source's own maximum."""
    if not candidates:
        return {}
    peak = max(c.metric for c in candidates)
    if peak <= 0:
        # No usable metric: rank by the order the source returned them.
        return {c.title: 1.0 - (i / len(candidates)) for i, c in enumerate(candidates)}
    return {c.title: c.metric / peak for c in candidates}


def merge(
    per_source: dict[str, list[RawCandidate]],
    weights: dict[str, float],
    corroboration_bonus: float,
) -> list[Topic]:
    """Merge per-source candidates into deduplicated, cross-source-weighted topics."""
    merged: dict[str, Topic] = {}
    for source, candidates in per_source.items():
        weight = weights.get(source, 1.0)
        scaled = normalise(candidates)
        for candidate in candidates:
            key = topic_key(candidate.title)
            if not key:
                continue
            contribution = scaled.get(candidate.title, 0.0) * weight
            existing = merged.get(key)
            if existing is None:
                merged[key] = Topic(
                    title=candidate.title,
                    score=contribution,
                    sources=[source],
                    url=candidate.url,
                    summary=candidate.summary,
                )
                continue
            existing.score += contribution
            if source not in existing.sources:
                existing.sources.append(source)
            # Prefer the longest summary available across sources.
            if len(candidate.summary) > len(existing.summary):
                existing.summary = candidate.summary
            if not existing.url:
                existing.url = candidate.url

    for topic in merged.values():
        extra_sources = len(topic.sources) - 1
        topic.score *= 1.0 + corroboration_bonus * extra_sources

    return sorted(merged.values(), key=lambda t: t.score, reverse=True)


def collect(
    cfg: DiscoveryConfig, session: requests.Session | None = None
) -> dict[str, list[RawCandidate]]:
    """Query every configured source, tolerating individual source failures."""
    owned = session is None
    session = session or requests.Session()
    # requests presets User-Agent, so setdefault would silently keep python-requests
    # here - and the Wikimedia API rejects that with a 429. Api-User-Agent is the
    # header the Wikimedia REST gateway actually enforces.
    session.headers.update({"User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT})
    per_source: dict[str, list[RawCandidate]] = {}
    try:
        for name in cfg.sources:
            fetcher = SOURCES.get(name)
            if fetcher is None:
                logger.warning("unknown discovery source %r, skipping", name)
                continue
            try:
                candidates = fetcher(session, cfg)
            except (requests.RequestException, ValueError, DiscoveryError) as exc:
                logger.warning("discovery source %s failed: %s", name, exc)
                continue
            logger.info("discovery source %s returned %d candidates", name, len(candidates))
            if candidates:
                per_source[name] = candidates
    finally:
        if owned:
            session.close()
    return per_source


def rank(
    cfg: DiscoveryConfig,
    per_source: dict[str, list[RawCandidate]],
    state: State | None = None,
    blocklist_extra: tuple[str, ...] = (),
) -> list[Topic]:
    """Merge, screen for brand safety, drop cooled-down repeats, and rank."""
    ranked = []
    for topic in merge(per_source, cfg.weights, cfg.corroboration_bonus):
        if topic.score < cfg.min_score:
            continue
        verdict = screen(f"{topic.title} {topic.summary}", blocklist_extra)
        if not verdict.safe:
            logger.info("skipping %r: blocked by %s", topic.title, verdict.reason)
            continue
        if state is not None and state.used_recently(topic.title, cfg.cooldown_days):
            logger.info("skipping %r: covered within the last %d days", topic.title, cfg.cooldown_days)
            continue
        ranked.append(topic)
    return ranked


def discover(
    cfg: DiscoveryConfig,
    state: State | None = None,
    blocklist_extra: tuple[str, ...] = (),
    session: requests.Session | None = None,
) -> list[Topic]:
    """Full discovery pass: collect from every source, then merge and rank."""
    per_source = collect(cfg, session)
    if not per_source:
        raise DiscoveryError("every discovery source failed or returned nothing")
    ranked = rank(cfg, per_source, state, blocklist_extra)
    if not ranked:
        raise DiscoveryError(
            "no topic survived screening (all were blocked, repeated, or below min_score)"
        )
    return ranked
