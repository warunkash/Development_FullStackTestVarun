"""Configuration: bot-level settings plus the tasks the bot runs.

Config is a YAML (or JSON) file so the same definition drives the one-shot CLI,
the long-running daemon and the GitHub Actions job. Anything a deployment needs
to override without editing the file is also readable from the environment.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .models import Goal

DEFAULT_CONFIG_NAMES = ("autobot.yaml", "autobot.yml", "autobot.json")


class ConfigError(Exception):
    """Raised when a config file is missing, malformed or internally inconsistent."""


@dataclass
class TaskSpec:
    """One unit of autonomous work."""

    name: str
    objective: str
    context: dict[str, Any] = field(default_factory=dict)
    max_steps: int = 12
    deadline_s: float = 300.0
    playbook: list[dict[str, Any]] = field(default_factory=list)
    #: How often the daemon should run this task, in seconds.
    interval_s: float = 900.0
    enabled: bool = True

    def to_goal(self) -> Goal:
        return Goal(
            name=self.name,
            objective=self.objective,
            context=dict(self.context),
            max_steps=self.max_steps,
            deadline_s=self.deadline_s,
            playbook=list(self.playbook),
        )

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "TaskSpec":
        if not isinstance(raw, dict):
            raise ConfigError(f"each task must be a mapping, got {type(raw).__name__}")
        for key in ("name", "objective"):
            # YAML 1.1 turns bare off/on/no/yes into booleans, so `name: off`
            # silently becomes False. Say so rather than reporting it missing.
            if isinstance(raw.get(key), bool):
                raise ConfigError(
                    f"task {key} must be text, but YAML read {raw[key]!r} as a boolean; "
                    f'quote it (e.g. {key}: "off")'
                )
        missing = [k for k in ("name", "objective") if not raw.get(k)]
        if missing:
            raise ConfigError(f"task is missing required key(s): {', '.join(missing)}")
        unknown = set(raw) - {f.name for f in cls.__dataclass_fields__.values()}
        if unknown:
            raise ConfigError(
                f"task '{raw['name']}' has unknown key(s): {', '.join(sorted(unknown))}"
            )
        return cls(
            name=str(raw["name"]),
            objective=str(raw["objective"]),
            context=dict(raw.get("context") or {}),
            max_steps=int(raw.get("max_steps", 12)),
            deadline_s=float(raw.get("deadline_s", 300.0)),
            playbook=list(raw.get("playbook") or []),
            interval_s=float(raw.get("interval_s", 900.0)),
            enabled=bool(raw.get("enabled", True)),
        )


@dataclass
class BotConfig:
    """Everything the bot needs to start."""

    workspace: str = "."
    journal_dir: str = "runs"
    policy: str = "rule"
    model: str = "claude-opus-5"
    effort: str = "high"
    max_tokens: int = 16000
    #: Hosts ``http_get`` may reach. Empty means "any host" - set it in production.
    allowed_domains: list[str] = field(default_factory=list)
    #: Tools marked ``dangerous`` (e.g. run_command) are unavailable unless this is on.
    allow_dangerous_tools: bool = False
    failure_limit: int = 3
    #: Optional integration settings, e.g. {"dry_run": true, "max_pins_per_run": 5}.
    #: The access token itself is never stored here - it comes from the
    #: PINTEREST_ACCESS_TOKEN environment variable.
    pinterest: dict[str, Any] = field(default_factory=dict)
    tasks: list[TaskSpec] = field(default_factory=list)

    def task(self, name: str) -> TaskSpec:
        for spec in self.tasks:
            if spec.name == name:
                return spec
        known = ", ".join(t.name for t in self.tasks) or "(none defined)"
        raise ConfigError(f"no task named '{name}'; known tasks: {known}")

    @property
    def enabled_tasks(self) -> list[TaskSpec]:
        return [t for t in self.tasks if t.enabled]

    @property
    def uses_claude_policy(self) -> bool:
        return self.policy.strip().lower() in {"claude", "llm", "anthropic"}

    def tasks_reaching(self, tool_prefix: str) -> list[TaskSpec]:
        """Enabled tasks that could call a tool whose name starts with ``tool_prefix``.

        A playbook names its tools up front, so it can be checked exactly. An
        open-ended task has no playbook and the model picks the tools, so under
        the claude policy it must be assumed to reach anything available.
        """
        reaching = []
        for spec in self.enabled_tasks:
            if spec.playbook:
                if any(str(e.get("tool", "")).startswith(tool_prefix) for e in spec.playbook):
                    reaching.append(spec)
            elif self.uses_claude_policy:
                reaching.append(spec)
        return reaching

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "BotConfig":
        if not isinstance(raw, dict):
            raise ConfigError("config root must be a mapping")
        unknown = set(raw) - {f.name for f in cls.__dataclass_fields__.values()}
        if unknown:
            raise ConfigError(f"unknown config key(s): {', '.join(sorted(unknown))}")

        tasks = [TaskSpec.from_dict(t) for t in (raw.get("tasks") or [])]
        names = [t.name for t in tasks]
        duplicates = {n for n in names if names.count(n) > 1}
        if duplicates:
            raise ConfigError(f"duplicate task name(s): {', '.join(sorted(duplicates))}")

        config = cls(
            workspace=str(raw.get("workspace", ".")),
            journal_dir=str(raw.get("journal_dir", "runs")),
            policy=str(raw.get("policy", "rule")),
            model=str(raw.get("model", "claude-opus-5")),
            effort=str(raw.get("effort", "high")),
            max_tokens=int(raw.get("max_tokens", 16000)),
            allowed_domains=[str(d).lower() for d in (raw.get("allowed_domains") or [])],
            allow_dangerous_tools=bool(raw.get("allow_dangerous_tools", False)),
            failure_limit=int(raw.get("failure_limit", 3)),
            pinterest=_validated_pinterest(raw.get("pinterest") or {}),
            tasks=tasks,
        )
        return config.with_env_overrides()

    def with_env_overrides(self) -> "BotConfig":
        """Apply ``AUTOBOT_*`` environment overrides in place and return self."""
        env = os.environ
        if value := env.get("AUTOBOT_POLICY"):
            self.policy = value
        if value := env.get("AUTOBOT_WORKSPACE"):
            self.workspace = value
        if value := env.get("AUTOBOT_JOURNAL_DIR"):
            self.journal_dir = value
        if value := env.get("AUTOBOT_MODEL"):
            self.model = value
        if value := env.get("AUTOBOT_EFFORT"):
            self.effort = value
        if value := env.get("AUTOBOT_ALLOWED_DOMAINS"):
            self.allowed_domains = [d.strip().lower() for d in value.split(",") if d.strip()]
        if value := env.get("AUTOBOT_ALLOW_DANGEROUS_TOOLS"):
            self.allow_dangerous_tools = value.strip().lower() in {"1", "true", "yes"}
        return self


_PINTEREST_KEYS = {"dry_run", "sandbox", "base_url", "max_pins_per_run", "timeout_s"}


def _validated_pinterest(section: Any) -> dict[str, Any]:
    """Check the pinterest block, so a typo fails loudly instead of silently.

    A misspelled ``dry_run`` would otherwise fall back to the safe default and
    look like it worked - but the reverse mistake, a typo that leaves dry-run on
    when the user meant it off, is just as confusing. Reject both.
    """
    if not isinstance(section, dict):
        raise ConfigError("the 'pinterest' config section must be a mapping")
    unknown = set(section) - _PINTEREST_KEYS
    if unknown:
        raise ConfigError(
            f"unknown key(s) in the 'pinterest' section: {', '.join(sorted(unknown))}; "
            f"expected any of {', '.join(sorted(_PINTEREST_KEYS))}"
        )
    if "dry_run" in section and not isinstance(section["dry_run"], bool):
        raise ConfigError("pinterest.dry_run must be true or false")
    return dict(section)


def load_raw(path: str | Path) -> dict[str, Any]:
    """Parse a YAML or JSON config file into a plain dict."""
    target = Path(path)
    if not target.is_file():
        raise ConfigError(f"config file not found: {target}")
    text = target.read_text(encoding="utf-8")

    if target.suffix.lower() == ".json":
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise ConfigError(f"{target}: invalid JSON: {exc}") from exc

    try:
        import yaml
    except ImportError as exc:
        raise ConfigError(
            f"{target} is YAML but PyYAML is not installed; "
            "run 'pip install pyyaml' or use a .json config"
        ) from exc
    try:
        return yaml.safe_load(text) or {}
    except yaml.YAMLError as exc:
        raise ConfigError(f"{target}: invalid YAML: {exc}") from exc


def load_config(path: str | Path | None = None) -> BotConfig:
    """Load config from ``path``, or from the first default name that exists."""
    if path is not None:
        return BotConfig.from_dict(load_raw(path))
    for name in DEFAULT_CONFIG_NAMES:
        candidate = Path(name)
        if candidate.is_file():
            return BotConfig.from_dict(load_raw(candidate))
    raise ConfigError(
        f"no config file given and none of {', '.join(DEFAULT_CONFIG_NAMES)} found "
        f"in {Path.cwd()}"
    )
