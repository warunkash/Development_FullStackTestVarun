"""One registry, one kernel, two agents that differ only by configuration.

Run it:  python examples/two_agents.py

Shows all six subsystems doing something visible:
  * the same tool permitted for one agent and denied for the other
  * an argument constraint stopping a path traversal
  * a runaway planner cut off by the step ceiling
  * a kill switch stopping a loop mid-run
  * memory outliving the process that wrote it
  * a trace that explains each ending
"""

from __future__ import annotations

import tempfile
from pathlib import Path

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

# --- the OS half: written once ------------------------------------------------

registry = Registry()


@registry.tool(description="Read a UTF-8 text file", cost=0.01)
def read_file(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


@registry.tool(description="List a directory", cost=0.01)
def list_dir(path: str) -> list[str]:
    return sorted(p.name for p in Path(path).iterdir())


@registry.tool(description="Delete a file — destructive", cost=0.0)
def delete_file(path: str) -> str:
    Path(path).unlink()
    return f"deleted {path}"


def show(label: str, result) -> None:
    verdict = "ok" if result.ok else f"HALTED ({result.halted_by})"
    print(f"  {label:<34} {verdict}")
    print(f"  {'':<34} {result.trace.why()}")
    print(f"  {'':<34} steps={result.steps} cost={result.budget['cost_used']}")
    print()


def main() -> None:
    workspace = Path(tempfile.mkdtemp(prefix="agentos-"))
    (workspace / "notes.txt").write_text("the quarterly numbers are fine\n")
    (workspace / "draft.md").write_text("# draft\n")
    db = workspace / "memory.db"

    # --- the config half: this is all that changes per agent -------------------

    reader = AgentSpec(
        name="reader",
        policy=Policy()
        .allow("read_file", path_within("path", workspace))
        .allow("list_dir", path_within("path", workspace)),
        budget=Budget(max_steps=8, max_cost=1.0),
    )
    janitor = AgentSpec(
        name="janitor",
        policy=Policy()
        .allow("list_dir", path_within("path", workspace))
        .allow("delete_file", path_within("path", workspace)),
        budget=Budget(max_steps=8),
    )

    def call_once(tool, **args):
        def planner(state):
            return Action.done(state.last.result) if state.last else Action.call(tool, **args)

        return planner

    print(f"\nworkspace: {workspace}\n")
    print("1. same registry, different reach")
    show(
        "reader reads notes.txt",
        Kernel(registry, reader, Memory(db, "reader")).run(
            "read the notes", call_once("read_file", path=str(workspace / "notes.txt"))
        ),
    )
    show(
        "reader tries to delete",
        Kernel(registry, reader, Memory(db, "reader")).run(
            "delete the draft", call_once("delete_file", path=str(workspace / "draft.md"))
        ),
    )
    show(
        "janitor deletes the same file",
        Kernel(registry, janitor, Memory(db, "janitor")).run(
            "delete the draft", call_once("delete_file", path=str(workspace / "draft.md"))
        ),
    )

    print("2. argument constraints, not just tool names")
    show(
        "reader reads /etc/passwd",
        Kernel(registry, reader, Memory(db, "reader")).run(
            "read the password file", call_once("read_file", path="/etc/passwd")
        ),
    )
    show(
        "reader escapes with ../../",
        Kernel(registry, reader, Memory(db, "reader")).run(
            "escape the sandbox",
            call_once("read_file", path=str(workspace / ".." / ".." / "etc" / "passwd")),
        ),
    )

    print("3. a planner that never finishes")
    show(
        "runaway loop",
        Kernel(registry, reader, Memory(db, "reader")).run(
            "loop forever", lambda s: Action.call("list_dir", path=str(workspace))
        ),
    )

    print("4. the kill switch")
    switch = KillSwitch()

    def trip_after_two(state):
        if len(state.observations) == 2:
            switch.trip("operator stopped it")
        return Action.call("list_dir", path=str(workspace))

    show(
        "stopped mid-run",
        Kernel(
            registry,
            AgentSpec("reader", reader.policy, Budget(max_steps=50)),
            Memory(db, "reader"),
            kill_switch=switch,
        ).run("loop until stopped", trip_after_two),
    )

    print("5. memory outlives the run")
    fresh = Memory(db, "reader")
    print(f"  goals recorded across every run above: {len(fresh.episodes(kind='goal'))}")
    for episode in fresh.episodes(kind="goal", limit=3):
        print(f"    - {episode.body}")
    print(f"\n  (memory file: {db})\n")


if __name__ == "__main__":
    main()
