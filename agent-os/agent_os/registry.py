"""The tool registry — the only place an agent can call from.

The kernel resolves every action through this object. A name that is not
registered does not run, so "the model hallucinated a tool" becomes a caught
`UnknownToolError` instead of an attribute error deep in your code.

Schemas are intentionally small: a dict of ``name -> type``, plus which names
are required. That is enough to reject a malformed call before the tool body
sees it, without pulling in a validation library.
"""

from __future__ import annotations

import inspect
from dataclasses import dataclass, field
from typing import Any, Callable, get_type_hints

from .errors import ToolValidationError, UnknownToolError


@dataclass(frozen=True)
class Tool:
    name: str
    fn: Callable[..., Any]
    description: str
    params: dict[str, type]
    required: frozenset[str]
    # Cost is declared per tool, in whatever unit your budget is denominated in
    # (dollars, credits, tokens). The kernel charges it on every call.
    cost: float = 0.0

    def validate(self, args: dict[str, Any]) -> None:
        missing = self.required - args.keys()
        if missing:
            raise ToolValidationError(
                f"{self.name}: missing required argument(s): {', '.join(sorted(missing))}"
            )
        unexpected = args.keys() - self.params.keys()
        if unexpected:
            raise ToolValidationError(
                f"{self.name}: unexpected argument(s): {', '.join(sorted(unexpected))}"
            )
        for key, value in args.items():
            expected = self.params[key]
            if expected is Any:
                continue
            # bool is a subclass of int; treating them as interchangeable makes
            # permission rules on numeric arguments easy to fool.
            if expected is int and isinstance(value, bool):
                raise ToolValidationError(f"{self.name}: {key} must be int, got bool")
            if not isinstance(value, expected):
                raise ToolValidationError(
                    f"{self.name}: {key} must be {expected.__name__}, "
                    f"got {type(value).__name__}"
                )

    def spec(self) -> dict[str, Any]:
        """A description you can hand to a model as its tool list."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                name: {
                    "type": typ.__name__ if typ is not Any else "any",
                    "required": name in self.required,
                }
                for name, typ in self.params.items()
            },
        }


@dataclass
class Registry:
    _tools: dict[str, Tool] = field(default_factory=dict)

    def tool(
        self, name: str | None = None, description: str = "", cost: float = 0.0
    ) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        """Decorator. Registers the function and hands it straight back.

            @registry.tool(description="Read a file", cost=0.0)
            def read_file(path: str) -> str: ...

        Types come from the annotations; anything without a default is required.
        """

        def wrap(fn: Callable[..., Any]) -> Callable[..., Any]:
            self.register(fn, name=name or fn.__name__, description=description, cost=cost)
            return fn

        return wrap

    def register(
        self,
        fn: Callable[..., Any],
        name: str | None = None,
        description: str = "",
        cost: float = 0.0,
    ) -> Tool:
        tool_name = name or fn.__name__
        if tool_name in self._tools:
            raise ValueError(f"tool already registered: {tool_name}")

        sig = inspect.signature(fn)
        try:
            hints = get_type_hints(fn)
        except Exception:  # pragma: no cover - exotic annotations
            hints = {}

        params: dict[str, type] = {}
        required: set[str] = set()
        for pname, param in sig.parameters.items():
            if param.kind in (param.VAR_POSITIONAL, param.VAR_KEYWORD):
                raise ValueError(f"{tool_name}: *args/**kwargs tools are not supported")
            params[pname] = hints.get(pname, Any)
            if param.default is param.empty:
                required.add(pname)

        tool = Tool(
            name=tool_name,
            fn=fn,
            description=description or (inspect.getdoc(fn) or "").split("\n")[0],
            params=params,
            required=frozenset(required),
            cost=cost,
        )
        self._tools[tool_name] = tool
        return tool

    def get(self, name: str) -> Tool:
        try:
            return self._tools[name]
        except KeyError:
            known = ", ".join(sorted(self._tools)) or "none registered"
            raise UnknownToolError(f"no such tool: {name!r} (available: {known})") from None

    def names(self) -> list[str]:
        return sorted(self._tools)

    def specs(self) -> list[dict[str, Any]]:
        """Every tool's spec — the list you show the model."""
        return [self._tools[n].spec() for n in self.names()]

    def __contains__(self, name: object) -> bool:
        return name in self._tools

    def __len__(self) -> int:
        return len(self._tools)
