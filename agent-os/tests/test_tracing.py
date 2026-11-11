import json

import pytest

from agent_os import (
    Action,
    AgentSpec,
    Budget,
    Kernel,
    Policy,
    Registry,
    Trace,
    read_trace,
)
from agent_os.tracing import MAX_REPR


@pytest.fixture
def registry():
    r = Registry()

    @r.tool()
    def echo(text: str) -> str:
        return text

    @r.tool()
    def explode() -> str:
        raise RuntimeError("boom")

    @r.tool()
    def firehose() -> str:
        return "x" * (MAX_REPR * 3)

    return r


def test_trace_records_the_whole_run(registry):
    k = Kernel(registry, AgentSpec("t", Policy.allowing("echo")))
    res = k.run("g", lambda s: Action.done("x") if s.last else Action.call("echo", text="hi"))
    kinds = [e.kind for e in res.trace]
    assert kinds[0] == "run_start" and kinds[-1] == "run_end"
    assert "tool_result" in kinds


def test_why_explains_a_budget_halt(registry):
    k = Kernel(registry, AgentSpec("t", Policy.allowing("echo"), Budget(max_steps=2)))
    res = k.run("g", lambda s: Action.call("echo", text="loop"))
    assert "budget_exceeded" in res.trace.why()
    assert res.trace.failed is True


def test_why_explains_a_permission_halt(registry):
    k = Kernel(registry, AgentSpec("t", Policy.nothing()))
    res = k.run("g", lambda s: Action.call("echo", text="hi"))
    assert "permission_denied" in res.trace.why()


def test_why_on_a_clean_run(registry):
    k = Kernel(registry, AgentSpec("t", Policy.allowing("echo")))
    res = k.run("g", lambda s: Action.done("x") if s.last else Action.call("echo", text="hi"))
    assert res.trace.why() == "completed in 1 step(s)"
    assert res.trace.failed is False


def test_tool_errors_are_traced_with_the_exception(registry):
    k = Kernel(registry, AgentSpec("t", Policy.allowing("explode")))
    res = k.run("g", lambda s: Action.done() if s.last else Action.call("explode"))
    errors = res.trace.of_kind("tool_error")
    assert len(errors) == 1 and "boom" in errors[0].data["error"]


def test_huge_results_are_truncated_not_dropped(registry):
    k = Kernel(registry, AgentSpec("t", Policy.allowing("firehose")))
    res = k.run("g", lambda s: Action.done() if s.last else Action.call("firehose"))
    recorded = res.trace.of_kind("tool_result")[0].data["result"]
    assert recorded["_truncated"] is True
    assert recorded["_length"] > MAX_REPR
    assert len(recorded["_head"]) == MAX_REPR


def test_trace_is_written_to_disk_as_jsonl(registry, tmp_path):
    k = Kernel(registry, AgentSpec("t", Policy.allowing("echo"), trace_dir=tmp_path))
    res = k.run("g", lambda s: Action.done("x") if s.last else Action.call("echo", text="hi"))

    written = tmp_path / f"{res.run_id}.jsonl"
    assert written.exists()
    rows = read_trace(written)
    assert [r["kind"] for r in rows] == [e.kind for e in res.trace]
    assert all(r["run_id"] == res.run_id for r in rows)


def test_reader_tolerates_a_truncated_final_line(tmp_path):
    # What a killed process leaves behind — and the run you most want to read.
    path = tmp_path / "t.jsonl"
    path.write_text(json.dumps({"kind": "run_start"}) + "\n" + '{"kind": "ste')
    assert [r["kind"] for r in read_trace(path)] == ["run_start"]


def test_unserialisable_values_do_not_break_the_trace(tmp_path):
    trace = Trace(path=tmp_path / "t.jsonl")
    trace.emit("step", value=object())
    trace.close()
    assert len(read_trace(tmp_path / "t.jsonl")) == 1


def test_summary_shape(registry):
    k = Kernel(registry, AgentSpec("t", Policy.allowing("echo")))
    res = k.run("g", lambda s: Action.done("x") if s.last else Action.call("echo", text="hi"))
    summary = res.trace.summary()
    assert summary["steps"] == 1 and summary["failed"] is False
    assert summary["run_id"] == res.run_id
