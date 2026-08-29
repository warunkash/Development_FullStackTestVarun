"""agent_os — the layer an agent runs on.

Memory, a tool registry, scoped permissions, traces, budgets, a kill switch.
Build it once; every agent after that is configuration.

    from agent_os import Registry, Policy, Budget, AgentSpec, Kernel, Action

    registry = Registry()

    @registry.tool(description="Add two numbers")
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
"""

from .budget import Budget
from .errors import (
    AgentOSError,
    BudgetExceeded,
    HaltReason,
    Killed,
    PermissionDenied,
    ToolError,
    ToolValidationError,
    UnknownToolError,
)
from .kernel import Action, AgentSpec, Kernel, Observation, Planner, RunResult, State
from .killswitch import KillSwitch
from .memory import Episode, Memory
from .permissions import (
    Policy,
    Rule,
    arg_max,
    path_within,
    readonly_workspace,
    scratch_workspace,
    url_host_in,
)
from .registry import Registry, Tool
from .tracing import Event, Trace, read_trace

__version__ = "0.1.0"

__all__ = [
    "Action",
    "AgentOSError",
    "AgentSpec",
    "Budget",
    "BudgetExceeded",
    "Episode",
    "Event",
    "HaltReason",
    "Kernel",
    "KillSwitch",
    "Killed",
    "Memory",
    "Observation",
    "PermissionDenied",
    "Planner",
    "Policy",
    "Registry",
    "Rule",
    "RunResult",
    "State",
    "Tool",
    "ToolError",
    "ToolValidationError",
    "Trace",
    "UnknownToolError",
    "arg_max",
    "path_within",
    "read_trace",
    "readonly_workspace",
    "scratch_workspace",
    "url_host_in",
]
