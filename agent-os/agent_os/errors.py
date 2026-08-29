"""Exception hierarchy for the agent OS.

Every halt reason the kernel can produce is a distinct type, so a caller can
tell "the agent finished" from "the OS stopped it" without string matching.
"""


class AgentOSError(Exception):
    """Base for everything raised by the OS itself (never by tool bodies)."""


class ToolError(AgentOSError):
    """A tool was called incorrectly, or does not exist."""


class UnknownToolError(ToolError):
    """The agent named a tool that is not in the registry."""


class ToolValidationError(ToolError):
    """Arguments did not match the tool's declared schema."""


class HaltReason(AgentOSError):
    """Base for the conditions that stop a run before it completes."""


class PermissionDenied(HaltReason):
    """The run's policy does not allow this tool, or these arguments."""


class BudgetExceeded(HaltReason):
    """A step, time, or cost ceiling was reached."""


class Killed(HaltReason):
    """The kill switch was tripped."""
