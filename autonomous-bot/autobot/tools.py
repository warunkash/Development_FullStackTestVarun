"""Pluggable tool system.

A tool is an ordinary Python function wrapped with :func:`tool`. The decorator
derives a JSON Schema from the signature, type hints and docstring, so the same
definition serves both the deterministic policy and the Claude-backed one (which
sends the schema to the API verbatim).

    @tool(dangerous=False)
    def read_file(path: str, max_bytes: int = 20000) -> str:
        '''Read a UTF-8 text file.

        Args:
            path: Path relative to the workspace root.
            max_bytes: Truncate the file after this many bytes.
        '''
        ...
"""

from __future__ import annotations

import inspect
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Iterator, get_args, get_origin, get_type_hints


class ToolError(Exception):
    """Raised by a tool when it fails in an expected, reportable way."""


@dataclass
class ToolContext:
    """Ambient state handed to tools that declare a ``ctx`` parameter."""

    workspace: str
    config: Any = None
    scratch: dict[str, Any] = field(default_factory=dict)


_JSON_TYPES: dict[Any, str] = {
    str: "string",
    int: "integer",
    float: "number",
    bool: "boolean",
    list: "array",
    dict: "object",
}


def _json_type(annotation: Any) -> str:
    """Map a Python annotation onto a JSON Schema type name."""
    if annotation is inspect.Parameter.empty:
        return "string"
    origin = get_origin(annotation)
    if origin is not None:
        # Unwrap Optional[X] / X | None down to X.
        args = [a for a in get_args(annotation) if a is not type(None)]
        if origin is list:
            return "array"
        if origin is dict:
            return "object"
        if len(args) == 1:
            return _json_type(args[0])
        return "string"
    return _JSON_TYPES.get(annotation, "string")


_ARGS_HEADING = re.compile(r"^\s*(Args|Arguments|Parameters)\s*:\s*$")
_ARG_LINE = re.compile(r"^\s*(\*{0,2}\w+)\s*(?:\([^)]*\))?\s*:\s*(.+)$")


def parse_docstring(doc: str | None) -> tuple[str, dict[str, str]]:
    """Split a Google-style docstring into a summary and per-argument help.

    Returns the prose that precedes the ``Args:`` heading plus a mapping of
    argument name to its description.
    """
    if not doc:
        return "", {}

    summary_lines: list[str] = []
    arg_help: dict[str, str] = {}
    # "summary" -> prose before Args:, "args" -> inside it, "other" -> a later
    # section such as Returns:/Raises:, which belongs in neither.
    section = "summary"
    current: str | None = None

    for raw in inspect.cleandoc(doc).splitlines():
        if _ARGS_HEADING.match(raw):
            section = "args"
            current = None
            continue
        if section == "args":
            if raw.strip() and not raw.startswith((" ", "\t")) and raw.strip().endswith(":"):
                # A new section (Returns:, Raises:, ...) ends the Args block and
                # is not part of the description either.
                section = "other"
                continue
            match = _ARG_LINE.match(raw)
            if match:
                current = match.group(1).lstrip("*")
                arg_help[current] = match.group(2).strip()
            elif current and raw.strip():
                arg_help[current] += " " + raw.strip()
            continue
        if section == "summary":
            summary_lines.append(raw)

    return "\n".join(summary_lines).strip(), arg_help


@dataclass
class Tool:
    """A callable the agent may invoke, plus the metadata policies need."""

    name: str
    description: str
    func: Callable[..., Any]
    schema: dict[str, Any]
    dangerous: bool = False
    wants_context: bool = False

    def api_schema(self) -> dict[str, Any]:
        """The tool definition in Messages API shape."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.schema,
        }

    def call(self, args: dict[str, Any], ctx: ToolContext | None = None) -> Any:
        """Validate ``args`` against the schema and invoke the underlying function."""
        cleaned = self.validate(args)
        if self.wants_context:
            return self.func(ctx, **cleaned)
        return self.func(**cleaned)

    def validate(self, args: dict[str, Any]) -> dict[str, Any]:
        """Reject unknown/missing arguments and coerce obvious scalar mismatches."""
        props: dict[str, Any] = self.schema.get("properties", {})
        required: list[str] = self.schema.get("required", [])

        unknown = sorted(set(args) - set(props))
        if unknown:
            raise ToolError(
                f"{self.name}: unknown argument(s) {', '.join(unknown)}; "
                f"expected one of {', '.join(sorted(props)) or '(none)'}"
            )
        missing = [r for r in required if r not in args]
        if missing:
            raise ToolError(f"{self.name}: missing required argument(s) {', '.join(missing)}")

        cleaned: dict[str, Any] = {}
        for key, value in args.items():
            cleaned[key] = _coerce(self.name, key, value, props[key].get("type", "string"))
        return cleaned


def _coerce(tool_name: str, key: str, value: Any, want: str) -> Any:
    """Coerce a JSON scalar to the declared type, or raise ToolError."""
    if value is None:
        return None
    checks: dict[str, tuple[type, ...]] = {
        "string": (str,),
        "integer": (int,),
        "number": (int, float),
        "boolean": (bool,),
        "array": (list, tuple),
        "object": (dict,),
    }
    expected = checks.get(want, (object,))
    # bool is a subclass of int; keep the two from silently swapping.
    if want in {"integer", "number"} and isinstance(value, bool):
        raise ToolError(f"{tool_name}: argument '{key}' expected {want}, got boolean")
    if isinstance(value, expected):
        return list(value) if want == "array" else value

    try:
        if want == "integer":
            return int(value)
        if want == "number":
            return float(value)
        if want == "string":
            return str(value)
        if want == "boolean" and isinstance(value, str):
            if value.strip().lower() in {"true", "yes", "1"}:
                return True
            if value.strip().lower() in {"false", "no", "0"}:
                return False
    except (TypeError, ValueError):
        pass
    raise ToolError(f"{tool_name}: argument '{key}' expected {want}, got {type(value).__name__}")


def build_schema(func: Callable[..., Any]) -> tuple[dict[str, Any], str, bool]:
    """Derive ``(input_schema, description, wants_context)`` from a function."""
    signature = inspect.signature(func)
    try:
        hints = get_type_hints(func)
    except Exception:  # pragma: no cover - exotic annotations
        hints = {}
    summary, arg_help = parse_docstring(func.__doc__)

    properties: dict[str, Any] = {}
    required: list[str] = []
    wants_context = False

    for position, (name, param) in enumerate(signature.parameters.items()):
        annotation = hints.get(name, param.annotation)
        if position == 0 and (name == "ctx" or annotation is ToolContext):
            wants_context = True
            continue
        if param.kind in (param.VAR_POSITIONAL, param.VAR_KEYWORD):
            continue

        entry: dict[str, Any] = {"type": _json_type(annotation)}
        if name in arg_help:
            entry["description"] = arg_help[name]
        if entry["type"] == "array":
            entry["items"] = {"type": "string"}
        properties[name] = entry
        if param.default is inspect.Parameter.empty:
            required.append(name)

    schema = {"type": "object", "properties": properties, "required": required}
    return schema, summary or f"Tool {func.__name__}", wants_context


def tool(
    _func: Callable[..., Any] | None = None,
    *,
    name: str | None = None,
    dangerous: bool = False,
) -> Any:
    """Turn a function into a :class:`Tool`, keeping it directly callable.

    Args:
        name: Override the tool name (defaults to the function name).
        dangerous: Mark the tool as requiring explicit opt-in before the agent
            is allowed to call it.
    """

    def decorate(func: Callable[..., Any]) -> Callable[..., Any]:
        schema, description, wants_context = build_schema(func)
        func.tool = Tool(  # type: ignore[attr-defined]
            name=name or func.__name__,
            description=description,
            func=func,
            schema=schema,
            dangerous=dangerous,
            wants_context=wants_context,
        )
        return func

    if _func is not None:
        return decorate(_func)
    return decorate


class ToolRegistry:
    """The set of tools one agent is allowed to use."""

    def __init__(self, tools: list[Tool] | None = None) -> None:
        self._tools: dict[str, Tool] = {}
        for entry in tools or []:
            self.add(entry)

    def add(self, entry: Tool | Callable[..., Any]) -> Tool:
        """Register a :class:`Tool` or a ``@tool``-decorated function."""
        resolved = entry if isinstance(entry, Tool) else getattr(entry, "tool", None)
        if not isinstance(resolved, Tool):
            raise TypeError(f"{entry!r} is not a tool; decorate it with @tool")
        if resolved.name in self._tools:
            raise ValueError(f"duplicate tool name: {resolved.name}")
        self._tools[resolved.name] = resolved
        return resolved

    def get(self, name: str) -> Tool:
        try:
            return self._tools[name]
        except KeyError:
            raise ToolError(
                f"unknown tool '{name}'; available: {', '.join(sorted(self._tools)) or '(none)'}"
            ) from None

    def names(self) -> list[str]:
        return sorted(self._tools)

    def api_schemas(self) -> list[dict[str, Any]]:
        """Tool definitions for the Messages API, in a stable order.

        Order is sorted by name so the serialized tool block stays byte-identical
        across runs and stays cacheable.
        """
        return [self._tools[n].api_schema() for n in self.names()]

    def without_dangerous(self) -> "ToolRegistry":
        """A copy with every tool marked ``dangerous`` removed."""
        return ToolRegistry([t for t in self._tools.values() if not t.dangerous])

    def __contains__(self, name: object) -> bool:
        return name in self._tools

    def __len__(self) -> int:
        return len(self._tools)

    def __iter__(self) -> Iterator[Tool]:
        return iter(self._tools[n] for n in self.names())
