"""Scoped permissions — what this agent may touch, and nothing else.

Deny by default. A tool the policy does not name cannot be called even if it is
in the registry, which is what makes one registry safe to share across agents of
very different trust levels.

Beyond allow/deny by name, a rule can constrain the *arguments*: a filesystem
tool restricted to one directory, an HTTP tool restricted to a domain list. That
is where most real containment lives — `read_file` is harmless until it is
pointed at ``~/.ssh/id_rsa``.
"""

from __future__ import annotations

import fnmatch
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

from .errors import PermissionDenied

# A constraint returns None to allow, or a string explaining the refusal.
Constraint = Callable[[dict[str, Any]], str | None]


def path_within(arg: str, *roots: str | Path) -> Constraint:
    """Confine a path argument to one of `roots`.

    Resolves symlinks and ``..`` before comparing, so ``/tmp/safe/../../etc``
    does not slip through.
    """
    resolved_roots = [Path(r).expanduser().resolve() for r in roots]

    def check(args: dict[str, Any]) -> str | None:
        raw = args.get(arg)
        if raw is None:
            return None
        try:
            target = Path(str(raw)).expanduser().resolve()
        except (OSError, RuntimeError) as e:
            return f"{arg}={raw!r} could not be resolved ({e})"
        for root in resolved_roots:
            if target == root or root in target.parents:
                return None
        allowed = ", ".join(str(r) for r in resolved_roots)
        return f"{arg}={target} is outside the allowed root(s): {allowed}"

    return check


def url_host_in(arg: str, *hosts: str) -> Constraint:
    """Confine a URL argument to a host allowlist. Patterns may glob: ``*.co``."""

    def check(args: dict[str, Any]) -> str | None:
        raw = args.get(arg)
        if raw is None:
            return None
        parsed = urlparse(str(raw))
        if parsed.scheme not in ("http", "https"):
            return f"{arg}={raw!r} must be http(s)"
        host = (parsed.hostname or "").lower()
        if any(fnmatch.fnmatch(host, pattern.lower()) for pattern in hosts):
            return None
        return f"{arg} host {host!r} is not in the allowed set: {', '.join(hosts)}"

    return check


def arg_max(arg: str, ceiling: float) -> Constraint:
    """Cap a numeric argument — page sizes, retry counts, spend."""

    def check(args: dict[str, Any]) -> str | None:
        raw = args.get(arg)
        if raw is None:
            return None
        if not isinstance(raw, (int, float)) or isinstance(raw, bool):
            return f"{arg}={raw!r} is not numeric"
        if raw > ceiling:
            return f"{arg}={raw} exceeds the maximum of {ceiling}"
        return None

    return check


@dataclass(frozen=True)
class Rule:
    tool: str  # exact name, or a glob like "fs_*"
    constraints: tuple[Constraint, ...] = ()

    def matches(self, name: str) -> bool:
        return fnmatch.fnmatch(name, self.tool)


@dataclass
class Policy:
    """The set of rules one run operates under.

    ``Policy.nothing()`` is the honest default: an agent gets capabilities
    because someone wrote them down, not because a tool happened to be importable.
    """

    rules: list[Rule] = field(default_factory=list)

    @classmethod
    def nothing(cls) -> "Policy":
        return cls([])

    @classmethod
    def allowing(cls, *tools: str) -> "Policy":
        """Allow these tool names (globs fine), with no argument constraints."""
        return cls([Rule(t) for t in tools])

    def allow(self, tool: str, *constraints: Constraint) -> "Policy":
        """Add a rule. Chainable."""
        self.rules.append(Rule(tool, tuple(constraints)))
        return self

    def check(self, tool: str, args: dict[str, Any]) -> None:
        """Raise `PermissionDenied` unless some rule admits this exact call."""
        matching = [r for r in self.rules if r.matches(tool)]
        if not matching:
            allowed = ", ".join(r.tool for r in self.rules) or "nothing"
            raise PermissionDenied(f"tool {tool!r} is not permitted (policy allows: {allowed})")

        # Any one matching rule may admit the call; report why the closest one
        # refused when none do.
        refusals: list[str] = []
        for rule in matching:
            failures = [msg for c in rule.constraints if (msg := c(args)) is not None]
            if not failures:
                return
            refusals.extend(failures)
        raise PermissionDenied(f"{tool}: {'; '.join(refusals)}")

    def permitted(self, tool: str, args: dict[str, Any]) -> bool:
        """Non-raising form, for showing a model only what it can actually use."""
        try:
            self.check(tool, args)
            return True
        except PermissionDenied:
            return False


def readonly_workspace(root: str | Path) -> Policy:
    """A sensible starting policy: read inside one directory, nothing else."""
    root = Path(root).expanduser().resolve()
    return Policy().allow("read_file", path_within("path", root)).allow("list_dir", path_within("path", root))


def scratch_workspace(root: str | Path) -> Policy:
    """Read and write inside one directory, nothing else."""
    root = Path(root).expanduser().resolve()
    os.makedirs(root, exist_ok=True)
    return (
        Policy()
        .allow("read_file", path_within("path", root))
        .allow("write_file", path_within("path", root))
        .allow("list_dir", path_within("path", root))
    )
