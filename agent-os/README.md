# agent-os

The layer underneath the agent. Memory, a tool registry, scoped permissions,
traces, budgets, and a kill switch.

Everyone builds agents. The thing they run on usually isn't built at all —
without it you have a prompt with API keys and a lot of hope.

Build the OS once. Every agent after that is config, not a rebuild.

Zero dependencies, Python 3.10+.

## What's in it

| Piece | What it buys you |
|---|---|
| `Memory` | Facts and an episode log in SQLite. Survives the context window, and the process. |
| `Registry` | The only place an agent can call from. A hallucinated tool name is a caught error, not an `AttributeError` in your stack. |
| `Policy` | Deny by default, per run. Constrains *arguments*, not just tool names — `read_file` is harmless until it's pointed at `~/.ssh/id_rsa`. |
| `Trace` | Append-only JSONL per run, flushed every write. A crashed process still leaves everything up to the crash. |
| `Budget` | Step, wall-clock, and cost ceilings. Whichever binds first stops the run. |
| `KillSwitch` | In-process, or `touch /tmp/agent.stop` from anywhere. |
| `Kernel` | The loop that enforces all of the above in a fixed order. |

## Install

```bash
pip install -e .          # or just put agent_os/ on your path — no deps
pytest                    # 67 tests
python examples/two_agents.py
```

## The shape of it

```python
from agent_os import Registry, Policy, Budget, AgentSpec, Kernel, Action

registry = Registry()

@registry.tool(description="Add two numbers", cost=0.01)
def add(a: int, b: int) -> int:
    return a + b

spec = AgentSpec(name="calc", policy=Policy.allowing("add"), budget=Budget(max_steps=5))
kernel = Kernel(registry, spec)

def planner(state):
    if state.last and state.last.ok:
        return Action.done(state.last.result)
    return Action.call("add", a=2, b=3)

result = kernel.run("add 2 and 3", planner)
assert result.answer == 5
```

A **planner** is anything that turns state into a next action — a rules engine,
a search, a model call. The kernel doesn't import an LLM and doesn't care which
you use. That's why the whole thing tests in 0.3 seconds with no network.

## The order of checks

This is the design. `step()` does, in order:

1. **kill switch** — cheapest, and the one you want honoured first
2. **step / time ceiling** — before we bother the planner
3. **planner** — decides the next action
4. **kill switch again** — planning is the slow part; a stop during it counts
5. **registry** — the tool must exist
6. **policy** — the tool must be permitted, *with these arguments*
7. **schema** — the arguments must typecheck
8. **cost ceiling** — knowable only once we know which tool
9. **execute**

A tool body is never entered until all of them pass. Every check is traced
whether it passes or not, so a denied call is as visible as a successful one.

## Two agents, one registry

Permissions live on the spec, not the tool. That's what makes a single registry
safe to share across agents of very different trust levels:

```python
reader = AgentSpec("reader", Policy()
    .allow("read_file", path_within("path", workspace))
    .allow("list_dir",  path_within("path", workspace)))

janitor = AgentSpec("janitor", Policy()
    .allow("list_dir",    path_within("path", workspace))
    .allow("delete_file", path_within("path", workspace)))
```

Same `delete_file` in the registry. The reader halts with `permission_denied`;
the janitor runs it. Neither agent's code differs — only the spec.

## Constraining arguments

Tool-name allowlists are the easy half. The containment that matters is on the
arguments:

```python
from agent_os import path_within, url_host_in, arg_max

Policy().allow("read_file", path_within("path", "/srv/workspace"))
        .allow("fetch",     url_host_in("url", "example.com", "*.trusted.org"))
        .allow("spend",     arg_max("amount", 10))
```

`path_within` resolves symlinks and `..` before comparing, so
`/srv/workspace/../../etc/passwd` and a symlink pointing out of the root are
both denied. There are tests for both.

## When it fails

Tool exceptions are **observations**, not crashes — the agent sees the error and
can try something else. Only OS-level conditions halt a run:

```python
result = kernel.run(goal, planner)
if not result:
    print(result.halted_by)      # permission_denied | budget_exceeded | killed | tool_error
    print(result.trace.why())    # "budget_exceeded: step ceiling reached: 8/8 steps"
```

Traces are JSONL on disk when you set `trace_dir`, readable with `tail -f` while
the run is still going:

```python
from agent_os import read_trace
rows = read_trace("traces/ab12cd34ef56.jsonl")
```

`read_trace` skips a malformed final line, which is what a killed process leaves
behind — and that's the run you most want to read.

## Notes

- Results and arguments are clipped to 2 KB in traces, with the true length
  recorded, so a stuck loop can't fill the disk.
- Budgets reset per run. Set `Budget(carry_over=True)` for a lifetime cap across
  every run of a spec.
- `Memory` search is substring, not embeddings — deliberately. This layer
  shouldn't drag in a model or a vector store. Subclass it if you want ANN.
- `bool` is rejected where `int` is declared. It's a subclass of `int`, which
  would otherwise make numeric permission guards spoofable.
