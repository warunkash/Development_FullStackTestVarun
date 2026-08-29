import pytest

from agent_os import Memory


def test_facts_roundtrip_and_overwrite(tmp_path):
    m = Memory(tmp_path / "m.db", "agent")
    m.remember("plan", ["a", "b"])
    assert m.recall("plan") == ["a", "b"]
    m.remember("plan", ["c"])
    assert m.recall("plan") == ["c"]
    assert m.recall("absent", default="fallback") == "fallback"


def test_memory_survives_reopen(tmp_path):
    path = tmp_path / "m.db"
    with Memory(path, "agent") as m:
        m.remember("step", 7)
        m.record("note", "halfway through")

    # The point of the layer: a new process picks up where the last one died.
    with Memory(path, "agent") as m2:
        assert m2.recall("step") == 7
        assert [e.body for e in m2.episodes()] == ["halfway through"]


def test_namespaces_are_isolated(tmp_path):
    a = Memory(tmp_path / "m.db", "alpha")
    b = a.scoped("beta")
    a.remember("key", "from-alpha")
    b.remember("key", "from-beta")
    assert a.recall("key") == "from-alpha"
    assert b.recall("key") == "from-beta"
    assert a.keys() == ["key"] and b.keys() == ["key"]


def test_forget(tmp_path):
    m = Memory(tmp_path / "m.db")
    m.remember("k", 1)
    assert m.forget("k") is True
    assert m.forget("k") is False
    assert m.recall("k") is None


def test_episode_filtering_and_search(tmp_path):
    m = Memory(tmp_path / "m.db")
    m.record("obs", "fetched the sitemap", run_id="r1")
    m.record("obs", "parsed 40 urls", run_id="r1")
    m.record("err", "timeout on /pricing", run_id="r2")

    assert len(m.episodes()) == 3
    assert len(m.episodes(kind="obs")) == 2
    assert len(m.episodes(run_id="r2")) == 1
    assert [e.body for e in m.search("timeout")] == ["timeout on /pricing"]


def test_episodes_are_newest_first(tmp_path):
    m = Memory(tmp_path / "m.db")
    for i in range(5):
        m.record("n", str(i))
    assert [e.body for e in m.episodes(limit=2)] == ["4", "3"]
