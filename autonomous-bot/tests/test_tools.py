"""Tests for schema generation, argument validation and the workspace sandbox."""

from __future__ import annotations

import pytest

from autobot.builtins import default_registry
from autobot.tools import (
    Tool,
    ToolContext,
    ToolError,
    ToolRegistry,
    build_schema,
    parse_docstring,
    tool,
)


@tool
def sample(name: str, count: int = 1, ratio: float = 0.5, loud: bool = False) -> str:
    """Repeat a name.

    Args:
        name: The name to repeat.
        count: How many times to repeat it.
        ratio: Unused, present to exercise float handling.
        loud: Whether to shout.
    """
    text = " ".join([name] * count)
    return text.upper() if loud else text


@tool(dangerous=True)
def risky() -> str:
    """A tool that must be opted into."""
    return "boom"


class TestDocstringParsing:
    def test_splits_summary_from_args(self):
        summary, args = parse_docstring(sample.__doc__)
        assert summary == "Repeat a name."
        assert args["name"] == "The name to repeat."
        assert args["count"] == "How many times to repeat it."

    def test_handles_missing_docstring(self):
        assert parse_docstring(None) == ("", {})

    def test_stops_at_next_section(self):
        summary, args = parse_docstring(
            "Do a thing.\n\nArgs:\n    a: First.\n\nReturns:\n    Something else.\n"
        )
        assert summary == "Do a thing."
        assert set(args) == {"a"}


class TestSchemaGeneration:
    def test_types_and_required(self):
        schema = sample.tool.schema
        assert schema["properties"]["name"]["type"] == "string"
        assert schema["properties"]["count"]["type"] == "integer"
        assert schema["properties"]["ratio"]["type"] == "number"
        assert schema["properties"]["loud"]["type"] == "boolean"
        # Only the parameter without a default is required.
        assert schema["required"] == ["name"]

    def test_context_parameter_is_not_exposed(self):
        def needs_ctx(ctx: ToolContext, path: str) -> str:
            """Uses context.

            Args:
                path: A path.
            """
            return path

        schema, _, wants_context = build_schema(needs_ctx)
        assert wants_context is True
        assert "ctx" not in schema["properties"]
        assert schema["required"] == ["path"]

    def test_optional_annotation_unwraps(self):
        def maybe(value: str | None = None) -> str:
            """Takes an optional value."""
            return str(value)

        schema, _, _ = build_schema(maybe)
        assert schema["properties"]["value"]["type"] == "string"

    def test_api_schema_shape(self):
        api = sample.tool.api_schema()
        assert set(api) == {"name", "description", "input_schema"}
        assert api["name"] == "sample"


class TestValidation:
    def test_rejects_unknown_argument(self):
        with pytest.raises(ToolError, match="unknown argument"):
            sample.tool.validate({"name": "x", "nope": 1})

    def test_rejects_missing_required(self):
        with pytest.raises(ToolError, match="missing required argument"):
            sample.tool.validate({"count": 2})

    def test_coerces_numeric_string(self):
        assert sample.tool.validate({"name": "x", "count": "3"})["count"] == 3

    def test_rejects_bool_for_integer(self):
        # bool subclasses int; a silent swap here would be a real bug.
        with pytest.raises(ToolError, match="expected integer"):
            sample.tool.validate({"name": "x", "count": True})

    def test_rejects_uncoercible_value(self):
        with pytest.raises(ToolError, match="expected integer"):
            sample.tool.validate({"name": "x", "count": "many"})

    def test_call_applies_validation(self):
        assert sample.tool.call({"name": "hi", "count": "2"}) == "hi hi"


class TestRegistry:
    def test_add_and_get(self):
        registry = ToolRegistry([sample.tool])
        assert registry.get("sample") is sample.tool
        assert "sample" in registry

    def test_unknown_tool_lists_alternatives(self):
        registry = ToolRegistry([sample.tool])
        with pytest.raises(ToolError, match="available: sample"):
            registry.get("nope")

    def test_rejects_duplicates(self):
        registry = ToolRegistry([sample.tool])
        with pytest.raises(ValueError, match="duplicate tool name"):
            registry.add(sample.tool)

    def test_rejects_undecorated_function(self):
        with pytest.raises(TypeError, match="not a tool"):
            ToolRegistry().add(lambda: None)

    def test_without_dangerous_filters(self):
        registry = ToolRegistry([sample.tool, risky.tool])
        assert registry.names() == ["risky", "sample"]
        assert ToolRegistry.names(registry.without_dangerous()) == ["sample"]

    def test_api_schemas_are_name_sorted(self):
        # A stable order keeps the serialized tool block byte-identical, which
        # is what makes the cached prompt prefix reusable.
        registry = ToolRegistry([risky.tool, sample.tool])
        assert [s["name"] for s in registry.api_schemas()] == ["risky", "sample"]

    def test_default_registry_hides_dangerous_by_default(self):
        assert "run_command" not in default_registry()
        assert "run_command" in default_registry(include_dangerous=True)


class TestBuiltinsSandbox:
    def test_write_then_read_round_trip(self, tmp_path):
        ctx = ToolContext(workspace=str(tmp_path))
        registry = default_registry()
        registry.get("write_file").call({"path": "a/b.txt", "content": "hello"}, ctx)
        assert registry.get("read_file").call({"path": "a/b.txt"}, ctx) == "hello"

    def test_refuses_traversal_out_of_workspace(self, tmp_path):
        ctx = ToolContext(workspace=str(tmp_path))
        registry = default_registry()
        with pytest.raises(ToolError, match="outside the workspace"):
            registry.get("read_file").call({"path": "../escape.txt"}, ctx)

    def test_refuses_absolute_path_out_of_workspace(self, tmp_path):
        ctx = ToolContext(workspace=str(tmp_path))
        registry = default_registry()
        with pytest.raises(ToolError, match="outside the workspace"):
            registry.get("write_file").call({"path": "/etc/passwd", "content": "x"}, ctx)

    def test_remember_and_recall(self, tmp_path):
        ctx = ToolContext(workspace=str(tmp_path))
        registry = default_registry()
        registry.get("remember").call({"key": "k", "value": "v"}, ctx)
        assert registry.get("recall").call({"key": "k"}, ctx) == "v"

    def test_recall_missing_key_reports_known_keys(self, tmp_path):
        ctx = ToolContext(workspace=str(tmp_path))
        with pytest.raises(ToolError, match="nothing remembered"):
            default_registry().get("recall").call({"key": "ghost"}, ctx)

    def test_http_get_enforces_allowlist(self, tmp_path):
        class Config:
            allowed_domains = ["example.com"]

        ctx = ToolContext(workspace=str(tmp_path), config=Config())
        with pytest.raises(ToolError, match="not on the allowlist"):
            default_registry().get("http_get").call({"url": "https://evil.test/x"}, ctx)

    def test_http_get_rejects_non_http_scheme(self, tmp_path):
        ctx = ToolContext(workspace=str(tmp_path))
        with pytest.raises(ToolError, match="unsupported URL scheme"):
            default_registry().get("http_get").call({"url": "file:///etc/passwd"}, ctx)
