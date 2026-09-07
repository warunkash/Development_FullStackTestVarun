"""Tests for topic discovery: scoring, merging and filtering."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from faceless_content.config import DiscoveryConfig
from faceless_content.discovery import (
    RawCandidate,
    merge,
    normalise,
    parse_google_trends_rss,
    rank,
)
from faceless_content.errors import DiscoveryError
from faceless_content.state import State

TRENDS_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:ht="https://trends.google.com/trending/rss">
  <channel>
    <item>
      <title>solar eclipse</title>
      <link>https://trends.google.com/a</link>
      <ht:approx_traffic>200,000+</ht:approx_traffic>
      <ht:news_item>
        <ht:news_item_title>Where to watch the eclipse</ht:news_item_title>
      </ht:news_item>
    </item>
    <item>
      <title>sourdough starter</title>
      <ht:approx_traffic>20,000+</ht:approx_traffic>
    </item>
    <item>
      <title>no traffic figure</title>
    </item>
  </channel>
</rss>
"""


def test_parse_google_trends_rss_reads_traffic_and_summary():
    candidates = parse_google_trends_rss(TRENDS_RSS)
    assert [c.title for c in candidates] == ["solar eclipse", "sourdough starter", "no traffic figure"]
    assert candidates[0].metric == 200_000
    assert candidates[0].summary == "Where to watch the eclipse"
    # A missing traffic figure must not drop the item or crash the parse.
    assert candidates[2].metric == 1000.0


def test_parse_google_trends_rss_rejects_malformed_xml():
    with pytest.raises(DiscoveryError):
        parse_google_trends_rss("<rss><channel>")


def test_normalise_scales_against_the_source_peak():
    scaled = normalise(
        [
            RawCandidate("a", 100.0, "s"),
            RawCandidate("b", 50.0, "s"),
            RawCandidate("c", 0.0, "s"),
        ]
    )
    assert scaled == {"a": 1.0, "b": 0.5, "c": 0.0}


def test_normalise_falls_back_to_rank_order_without_metrics():
    scaled = normalise([RawCandidate("a", 0.0, "s"), RawCandidate("b", 0.0, "s")])
    assert scaled["a"] > scaled["b"]


def test_normalise_handles_no_candidates():
    assert normalise([]) == {}


def test_merge_deduplicates_across_sources_and_rewards_agreement():
    topics = merge(
        {
            "wikipedia": [RawCandidate("Octopus", 100.0, "wikipedia", summary="A cephalopod")],
            "reddit": [RawCandidate("The octopus!", 100.0, "reddit")],
            "hacker_news": [RawCandidate("Rust 2.0", 100.0, "hacker_news")],
        },
        weights={"wikipedia": 1.0, "reddit": 1.0, "hacker_news": 1.0},
        corroboration_bonus=0.5,
    )
    assert len(topics) == 2
    top = topics[0]
    assert sorted(top.sources) == ["reddit", "wikipedia"]
    # 1.0 + 1.0, then +50% for the second independent source.
    assert top.score == pytest.approx(3.0)
    # The richer summary survives the merge.
    assert top.summary == "A cephalopod"


def test_merge_keeps_the_longest_summary_and_first_url():
    topics = merge(
        {
            "a": [RawCandidate("Topic", 1.0, "a", url="http://a", summary="short")],
            "b": [RawCandidate("topic", 1.0, "b", url="http://b", summary="a much longer summary")],
        },
        weights={"a": 1.0, "b": 1.0},
        corroboration_bonus=0.0,
    )
    assert topics[0].summary == "a much longer summary"
    assert topics[0].url == "http://a"


def test_rank_drops_unsafe_topics():
    cfg = DiscoveryConfig(min_score=0.0)
    topics = rank(
        cfg,
        {"wikipedia": [RawCandidate("Six dead in bridge collapse", 100.0, "wikipedia")]},
    )
    assert topics == []


def test_rank_honours_the_extra_blocklist():
    cfg = DiscoveryConfig(min_score=0.0)
    per_source = {"wikipedia": [RawCandidate("Crypto token surges", 100.0, "wikipedia")]}
    assert rank(cfg, per_source) != []
    assert rank(cfg, per_source, blocklist_extra=("crypto",)) == []


def test_rank_applies_the_minimum_score():
    cfg = DiscoveryConfig(min_score=0.9)
    per_source = {
        "wikipedia": [
            RawCandidate("Loud topic", 100.0, "wikipedia"),
            RawCandidate("Quiet topic", 1.0, "wikipedia"),
        ]
    }
    assert [t.title for t in rank(cfg, per_source)] == ["Loud topic"]


def test_rank_skips_topics_inside_the_cooldown(tmp_path):
    cfg = DiscoveryConfig(min_score=0.0, cooldown_days=30)
    state = State(tmp_path / "state.json")
    state.record("The Octopus", now=datetime.now(timezone.utc) - timedelta(days=3))

    per_source = {
        "wikipedia": [
            RawCandidate("Octopus", 100.0, "wikipedia"),
            RawCandidate("Cuttlefish", 90.0, "wikipedia"),
        ]
    }
    assert [t.title for t in rank(cfg, per_source, state)] == ["Cuttlefish"]


def test_rank_allows_topics_past_the_cooldown(tmp_path):
    cfg = DiscoveryConfig(min_score=0.0, cooldown_days=7)
    state = State(tmp_path / "state.json")
    state.record("Octopus", now=datetime.now(timezone.utc) - timedelta(days=40))
    per_source = {"wikipedia": [RawCandidate("Octopus", 100.0, "wikipedia")]}
    assert [t.title for t in rank(cfg, per_source, state)] == ["Octopus"]
