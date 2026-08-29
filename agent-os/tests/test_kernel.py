import pytest

from agent_os import (
    Action,
    AgentSpec,
    Budget,
    Kernel,
    KillSwitch,
    Memory,
    Policy,
    Registry,
    path_within,
)


@pytest.fixture
def registry():
    r = Registry()

    @r.tool(description="Echo a string", cost=0.5)
    def echo(text: str) -> str:
        return text

    @r.tool(description="Always raises")
    def explode() -> str:
        raise RuntimeError("boom")

    @r.tool(description="Read a file")
    def read_file(path: str) -> str:
        with open(path) as fh:
            return fh.read()

    return r


def kernel_for(registry, policy, budget=None, **kw):
    return Kernel(registry, AgentSpec("t", policy, budget or Budget(max_steps=10), **kw))


def once(tool, **args):
    """A planner that calls `tool` once, then finishes with its result."""

    def planner(state):
        if state.last is not None:
            return Action.done(state.last.result)
        return Action.call(tool, **args)

    return planner


# -- happy path ---------------------------------------------------------------

def test_successful_run(registry):
    k = kernel_for(registry, Policy.allowing("echo"))
    res = k.run("say hi", once("echo", text="hi"))
    assert res.ok and res.answer == "hi" and res.steps == 1
    assert bool(res) is True


def test_cost_is_charged_per_call(registry):
    k = kernel_for(registry, Policy.allowing("echo"))
    res = k.run("g", once("echo", text="x"))
    assert res.budget["cost_used"] == 0.5


# -- the guarantees -----------------------------------------------------------

def test_unregistered_tool_halts_the_run(registry):
    k = kernel_for(registry, Policy.allowing("*"))
    res = k.run("g", once("rm_rf", path="/"))
    assert not res.ok and res.halted_by == "tool_error"
    assert "no such tool" in res.detail


def test_unpermitted_tool_halts_even_though_it_is_registered(registry):
    # The registry has `explode`; this agent's policy does not.
    k = kernel_for(registry, Policy.allowing("echo"))
    res = k.run("g", once("explode"))
    assert not res.ok and res.halted_by == "permission_denied"


def test_argument_constraint_halts_the_run(registry, tmp_path):
    policy = Policy().allow("read_file", path_within("path", tmp_path))
    k = kernel_for(registry, policy)
    res = k.run("g", once("read_file", path="/etc/passwd"))
    assert not res.ok and res.halted_by == "permission_denied"
    assert "outside the allowed root" in res.detail


def test_permitted_path_is_read(registry, tmp_path):
    target = tmp_path / "note.txt"
    target.write_text("contents")
    policy = Policy().allow("read_file", path_within("path", tmp_path))
    k = kernel_for(registry, policy)
    res = k.run("g", once("read_file", path=str(target)))
    assert res.ok and res.answer == "contents"


def test_bad_arguments_halt_before_the_tool_runs(registry):
    k = kernel_for(registry, Policy.allowing("echo"))
    res = k.run("g", once("echo", wrong="x"))
    assert not res.ok and res.halted_by == "tool_error"


def test_tool_exception_is_an_observation_not_a_crash(registry):
    """A failing tool should let the agent recover; only the OS halts runs."""
    seen = []

    def planner(state):
        if state.last is None:
            return Action.call("explode")
        seen.append(state.last)
        return Action.done("recovered")

    k = kernel_for(registry, Policy.allowing("explode", "echo"))
    res = k.run("g", planner)
    assert res.ok and res.answer == "recovered"
    assert seen[0].ok is False and "boom" in seen[0].error


def test_runaway_loop_is_stopped_by_the_step_ceiling(registry):
    # A planner that never finishes — the case the ceiling exists for.
    k = kernel_for(registry, Policy.allowing("echo"), Budget(max_steps=4))
    res = k.run("g", lambda state: Action.call("echo", text="again"))
    assert not res.ok and res.halted_by == "budget_exceeded"
    assert res.steps == 4


def test_cost_ceiling_stops_before_overspending(registry):
    k = kernel_for(registry, Policy.allowing("echo"), Budget(max_steps=100, max_cost=1.2))
    res = k.run("g", lambda state: Action.call("echo", text="again"))
    assert res.halted_by == "budget_exceeded"
    assert res.budget["cost_used"] <= 1.2  # never overspends


def test_kill_switch_stops_the_loop(registry):
    switch = KillSwitch()
    k = Kernel(
        registry,
        AgentSpec("t", Policy.allowing("echo"), Budget(max_steps=100)),
        kill_switch=switch,
    )

    def planner(state):
        if len(state.observations) == 2:
            switch.trip("supervisor pulled it")
        return Action.call("echo", text="loop")

    res = k.run("g", planner)
    assert not res.ok and res.halted_by == "killed"
    assert "supervisor pulled it" in res.detail
    assert res.steps == 2


def test_kill_file_stops_the_loop(registry, tmp_path):
    stop = tmp_path / "STOP"
    k = Kernel(
        registry,
        AgentSpec("t", Policy.allowing("echo"), Budget(max_steps=100), kill_file=stop),
    )

    def planner(state):
        if len(state.observations) == 3:
            stop.touch()
        return Action.call("echo", text="loop")

    res = k.run("g", planner)
    assert res.halted_by == "killed" and res.steps == 3


def test_planner_returning_nothing_is_an_error(registry):
    k = kernel_for(registry, Policy.allowing("echo"))
    res = k.run("g", lambda state: Action())
    assert not res.ok and res.halted_by == "tool_error"


# -- state and memory ---------------------------------------------------------

def test_planner_sees_remaining_steps(registry):
    seen = []

    def planner(state):
        seen.append(state.steps_remaining)
        return Action.done() if len(seen) > 2 else Action.call("echo", text="x")

    kernel_for(registry, Policy.allowing("echo"), Budget(max_steps=6)).run("g", planner)
    assert seen == [6, 5, 4]


def test_run_is_written_to_memory(registry, tmp_path):
    mem = Memory(tmp_path / "m.db", "t")
    k = Kernel(registry, AgentSpec("t", Policy.allowing("echo")), memory=mem)
    res = k.run("remember this goal", once("echo", text="hi"))
    goals = mem.episodes(kind="goal", run_id=res.run_id)
    assert [g.body for g in goals] == ["remember this goal"]
    assert len(mem.episodes(kind="observation", run_id=res.run_id)) == 1


def test_two_agents_share_one_registry_with_different_reach(registry, tmp_path):
    """The reason permissions live on the spec and not on the tool."""
    trusted = kernel_for(registry, Policy.allowing("echo", "explode"))
    limited = kernel_for(registry, Policy.allowing("echo"))
    assert trusted.run("g", once("explode")).halted_by != "permission_denied"
    assert limited.run("g", once("explode")).halted_by == "permission_denied"
