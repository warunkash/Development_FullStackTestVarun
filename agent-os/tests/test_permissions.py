import pytest

from agent_os import (
    PermissionDenied,
    Policy,
    arg_max,
    path_within,
    readonly_workspace,
    url_host_in,
)


def test_deny_by_default():
    with pytest.raises(PermissionDenied, match="not permitted"):
        Policy.nothing().check("read_file", {"path": "/etc/passwd"})


def test_denial_lists_what_is_allowed():
    policy = Policy.allowing("read_file", "list_dir")
    with pytest.raises(PermissionDenied) as e:
        policy.check("write_file", {})
    assert "read_file" in str(e.value) and "list_dir" in str(e.value)


def test_glob_rules():
    policy = Policy.allowing("fs_*")
    policy.check("fs_read", {})
    with pytest.raises(PermissionDenied):
        policy.check("net_get", {})


def test_path_constraint_confines_to_root(tmp_path):
    policy = Policy().allow("read_file", path_within("path", tmp_path))
    (tmp_path / "ok.txt").write_text("fine")
    policy.check("read_file", {"path": str(tmp_path / "ok.txt")})
    with pytest.raises(PermissionDenied, match="outside the allowed root"):
        policy.check("read_file", {"path": "/etc/passwd"})


def test_path_traversal_is_resolved_before_comparison(tmp_path):
    # The case that makes naive prefix checks useless.
    policy = Policy().allow("read_file", path_within("path", tmp_path))
    escape = str(tmp_path / ".." / ".." / "etc" / "passwd")
    with pytest.raises(PermissionDenied, match="outside the allowed root"):
        policy.check("read_file", {"path": escape})


def test_symlink_out_of_root_is_denied(tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    secret = tmp_path / "secret.txt"
    secret.write_text("no")
    (root / "link").symlink_to(secret)

    policy = Policy().allow("read_file", path_within("path", root))
    with pytest.raises(PermissionDenied, match="outside the allowed root"):
        policy.check("read_file", {"path": str(root / "link")})


def test_url_host_allowlist():
    policy = Policy().allow("fetch", url_host_in("url", "example.com", "*.trusted.org"))
    policy.check("fetch", {"url": "https://example.com/a"})
    policy.check("fetch", {"url": "https://api.trusted.org/v1"})
    with pytest.raises(PermissionDenied, match="not in the allowed set"):
        policy.check("fetch", {"url": "https://evil.test/x"})


def test_non_http_scheme_denied():
    policy = Policy().allow("fetch", url_host_in("url", "example.com"))
    with pytest.raises(PermissionDenied, match="must be http"):
        policy.check("fetch", {"url": "file:///etc/passwd"})


def test_numeric_ceiling():
    policy = Policy().allow("spend", arg_max("amount", 10))
    policy.check("spend", {"amount": 10})
    with pytest.raises(PermissionDenied, match="exceeds the maximum"):
        policy.check("spend", {"amount": 10.01})


def test_multiple_constraints_all_must_pass(tmp_path):
    policy = Policy().allow("read", path_within("path", tmp_path), arg_max("lines", 100))
    policy.check("read", {"path": str(tmp_path / "f"), "lines": 50})
    with pytest.raises(PermissionDenied, match="exceeds the maximum"):
        policy.check("read", {"path": str(tmp_path / "f"), "lines": 500})


def test_permitted_is_the_nonraising_form(tmp_path):
    policy = readonly_workspace(tmp_path)
    assert policy.permitted("read_file", {"path": str(tmp_path / "a")}) is True
    assert policy.permitted("write_file", {"path": str(tmp_path / "a")}) is False


def test_absent_argument_skips_its_constraint(tmp_path):
    # Presence is the schema's job; a constraint only judges values it is given.
    policy = Policy().allow("read", path_within("path", tmp_path))
    policy.check("read", {})
