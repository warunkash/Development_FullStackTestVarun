import pytest

from agent_os import Registry, UnknownToolError, ToolValidationError


@pytest.fixture
def registry():
    r = Registry()

    @r.tool(description="Add two ints", cost=0.25)
    def add(a: int, b: int) -> int:
        return a + b

    @r.tool()
    def greet(name: str, excited: bool = False) -> str:
        """Say hello to someone."""
        return f"hi {name}{'!' if excited else ''}"

    return r


def test_unknown_tool_names_the_alternatives(registry):
    with pytest.raises(UnknownToolError) as e:
        registry.get("delete_everything")
    assert "add" in str(e.value) and "greet" in str(e.value)


def test_required_vs_optional_inferred_from_defaults(registry):
    assert registry.get("greet").required == frozenset({"name"})
    assert registry.get("add").required == frozenset({"a", "b"})


def test_missing_argument_rejected(registry):
    with pytest.raises(ToolValidationError, match="missing required argument"):
        registry.get("add").validate({"a": 1})


def test_unexpected_argument_rejected(registry):
    with pytest.raises(ToolValidationError, match="unexpected argument"):
        registry.get("add").validate({"a": 1, "b": 2, "c": 3})


def test_wrong_type_rejected(registry):
    with pytest.raises(ToolValidationError, match="must be int"):
        registry.get("add").validate({"a": "1", "b": 2})


def test_bool_is_not_accepted_as_int(registry):
    # bool subclasses int; letting True through makes numeric guards spoofable.
    with pytest.raises(ToolValidationError, match="got bool"):
        registry.get("add").validate({"a": True, "b": 2})


def test_description_falls_back_to_docstring(registry):
    assert registry.get("greet").description == "Say hello to someone."


def test_duplicate_registration_rejected(registry):
    with pytest.raises(ValueError, match="already registered"):
        registry.register(lambda a: a, name="add")


def test_varargs_tools_rejected():
    r = Registry()
    with pytest.raises(ValueError, match=r"\*args"):
        r.register(lambda *a: a, name="splat")


def test_specs_are_model_ready(registry):
    spec = {s["name"]: s for s in registry.specs()}["add"]
    assert spec["parameters"]["a"] == {"type": "int", "required": True}
    assert spec["description"] == "Add two ints"
