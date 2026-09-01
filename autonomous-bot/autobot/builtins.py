"""Built-in tools.

These cover the things an autonomous run almost always needs - reading and
writing files, fetching a URL, scratch memory, and signalling completion.
Filesystem access is confined to the workspace root and network access to an
allowlist, because nothing here is reviewed by a human before it runs.
"""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from .tools import ToolContext, ToolError, tool

FINISH_TOOL = "finish"

_MAX_OUTPUT = 20_000


def _truncate(text: str, limit: int = _MAX_OUTPUT) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + f"\n... [truncated, {len(text) - limit} more characters]"


def _resolve(ctx: ToolContext | None, path: str) -> Path:
    """Resolve ``path`` inside the workspace, refusing to escape it."""
    if ctx is None:
        raise ToolError("no tool context available")
    root = Path(ctx.workspace).resolve()
    candidate = (root / path).resolve() if not os.path.isabs(path) else Path(path).resolve()
    if candidate != root and root not in candidate.parents:
        raise ToolError(f"path '{path}' resolves outside the workspace root {root}")
    return candidate


@tool
def finish(summary: str) -> str:
    """End the run and report what was accomplished.

    Call this as soon as the objective is met, or when it cannot be met and you
    want to explain why.

    Args:
        summary: A short account of what was done and what the outcome was.
    """
    return summary


@tool
def current_time() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@tool
def read_file(ctx: ToolContext, path: str, max_bytes: int = _MAX_OUTPUT) -> str:
    """Read a UTF-8 text file from the workspace.

    Args:
        path: Path relative to the workspace root.
        max_bytes: Stop reading after this many bytes.
    """
    target = _resolve(ctx, path)
    if not target.is_file():
        raise ToolError(f"not a file: {path}")
    data = target.read_bytes()[: max(0, max_bytes)]
    return data.decode("utf-8", errors="replace")


@tool
def write_file(ctx: ToolContext, path: str, content: str) -> str:
    """Write a UTF-8 text file into the workspace, creating parent directories.

    Args:
        path: Path relative to the workspace root.
        content: Full contents to write; any existing file is replaced.
    """
    target = _resolve(ctx, path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return f"wrote {len(content)} characters to {target}"


@tool
def list_dir(ctx: ToolContext, path: str = ".") -> str:
    """List the entries of a directory in the workspace.

    Args:
        path: Directory path relative to the workspace root.
    """
    target = _resolve(ctx, path)
    if not target.is_dir():
        raise ToolError(f"not a directory: {path}")
    entries = []
    for child in sorted(target.iterdir()):
        kind = "dir " if child.is_dir() else "file"
        size = "" if child.is_dir() else f" ({child.stat().st_size} bytes)"
        entries.append(f"{kind} {child.name}{size}")
    return "\n".join(entries) or "(empty)"


@tool
def http_get(ctx: ToolContext, url: str, max_bytes: int = _MAX_OUTPUT) -> str:
    """Fetch a URL over HTTP(S) and return the response body as text.

    Only hosts on the configured allowlist may be fetched.

    Args:
        url: Absolute http:// or https:// URL.
        max_bytes: Stop reading the body after this many bytes.
    """
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ToolError(f"unsupported URL scheme '{parsed.scheme}'; use http or https")
    host = (parsed.hostname or "").lower()
    if not host:
        raise ToolError(f"could not parse a hostname out of {url!r}")

    allowed = list(getattr(ctx.config, "allowed_domains", []) or []) if ctx else []
    if allowed and not any(host == d or host.endswith("." + d) for d in allowed):
        raise ToolError(
            f"host '{host}' is not on the allowlist ({', '.join(allowed)}); "
            "add it to allowed_domains to permit this fetch"
        )

    request = urllib.request.Request(url, headers={"User-Agent": "autobot/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read(max(0, max_bytes) + 1)
            status = response.status
    except urllib.error.HTTPError as exc:
        raise ToolError(f"HTTP {exc.code} fetching {url}") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise ToolError(f"could not fetch {url}: {exc}") from exc

    text = body.decode("utf-8", errors="replace")
    return f"HTTP {status}\n{_truncate(text, max_bytes)}"


@tool
def remember(ctx: ToolContext, key: str, value: str) -> str:
    """Store a value in scratch memory for later steps in this run.

    Args:
        key: Name to store the value under.
        value: The value to remember.
    """
    ctx.scratch[key] = value
    return f"remembered '{key}'"


@tool
def recall(ctx: ToolContext, key: str) -> str:
    """Read a value previously stored with ``remember``.

    Args:
        key: The name the value was stored under.
    """
    if key not in ctx.scratch:
        known = ", ".join(sorted(ctx.scratch)) or "(nothing remembered yet)"
        raise ToolError(f"nothing remembered under '{key}'; known keys: {known}")
    return str(ctx.scratch[key])


@tool(dangerous=True)
def run_command(ctx: ToolContext, command: str, timeout_s: int = 120) -> str:
    """Run a shell-free command in the workspace and return its output.

    The command is split with ``shlex`` and run without a shell, so pipes and
    redirection are not available. This tool is marked dangerous and must be
    enabled explicitly.

    Args:
        command: The command line to run, e.g. "python -m pytest -q".
        timeout_s: Kill the command after this many seconds.
    """
    argv = shlex.split(command)
    if not argv:
        raise ToolError("empty command")
    try:
        completed = subprocess.run(
            argv,
            cwd=ctx.workspace,
            capture_output=True,
            text=True,
            timeout=timeout_s,
            check=False,
        )
    except FileNotFoundError as exc:
        raise ToolError(f"command not found: {argv[0]}") from exc
    except subprocess.TimeoutExpired as exc:
        raise ToolError(f"command timed out after {timeout_s}s: {command}") from exc

    parts = [f"exit code: {completed.returncode}"]
    if completed.stdout.strip():
        parts.append("stdout:\n" + _truncate(completed.stdout))
    if completed.stderr.strip():
        parts.append("stderr:\n" + _truncate(completed.stderr))
    report = "\n".join(parts)
    if completed.returncode != 0:
        raise ToolError(report)
    return report


@tool
def append_json_line(ctx: ToolContext, path: str, record: dict) -> str:
    """Append one JSON object as a line to a JSONL file in the workspace.

    Args:
        path: Path to the .jsonl file, relative to the workspace root.
        record: The object to append.
    """
    target = _resolve(ctx, path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, sort_keys=True) + "\n")
    return f"appended 1 record to {target}"


#: Every built-in, including the dangerous ones. Callers filter with
#: ``ToolRegistry.without_dangerous()`` unless the config opts in.
BUILTIN_TOOLS = [
    finish,
    current_time,
    read_file,
    write_file,
    list_dir,
    http_get,
    remember,
    recall,
    append_json_line,
    run_command,
]


def default_registry(include_dangerous: bool = False):
    """Build a registry of the built-in tools."""
    from .tools import ToolRegistry

    registry = ToolRegistry([f.tool for f in BUILTIN_TOOLS])
    return registry if include_dangerous else registry.without_dangerous()
