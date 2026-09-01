"""autobot - a small, pluggable autonomous agent.

The loop is plan -> act -> observe under an explicit budget:

    from autobot import Agent, Goal, RulePolicy, default_registry

    agent = Agent(policy=RulePolicy(playbook), registry=default_registry())
    result = agent.run(Goal(name="demo", objective="say hello"))

Swap :class:`RulePolicy` for :class:`ClaudePolicy` to let a model choose the
actions instead of replaying a fixed plan.
"""

from .agent import Agent
from .builtins import BUILTIN_TOOLS, default_registry
from .config import BotConfig, ConfigError, TaskSpec, load_config
from .memory import Journal
from .models import Action, Budget, Goal, Observation, RunResult, Step
from .pinterest import PINTEREST_TOOLS, PinterestClient, PinterestConfig, PinterestError
from .policy import (
    BasePolicy,
    ClaudePolicy,
    PlaybookAborted,
    Policy,
    RulePolicy,
    build_policy,
)
from .runner import Runner, run_once
from .tools import Tool, ToolContext, ToolError, ToolRegistry, tool

__version__ = "1.0.0"

__all__ = [
    "Action",
    "Agent",
    "BUILTIN_TOOLS",
    "BasePolicy",
    "BotConfig",
    "Budget",
    "ClaudePolicy",
    "ConfigError",
    "Goal",
    "Journal",
    "PINTEREST_TOOLS",
    "Observation",
    "PlaybookAborted",
    "PinterestClient",
    "PinterestConfig",
    "PinterestError",
    "Policy",
    "RulePolicy",
    "RunResult",
    "Runner",
    "Step",
    "TaskSpec",
    "Tool",
    "ToolContext",
    "ToolError",
    "ToolRegistry",
    "build_policy",
    "default_registry",
    "load_config",
    "run_once",
    "tool",
    "__version__",
]
