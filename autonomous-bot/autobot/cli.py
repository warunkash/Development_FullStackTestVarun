"""Command-line entrypoint.

    autobot run <task>      run one task and exit (used by CI/cron)
    autobot serve           run every enabled task on its interval
    autobot tools           list the tools available under the current config
    autobot tasks           list configured tasks
    autobot doctor          check that the config and credentials are usable
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from typing import Sequence

from .config import BotConfig, ConfigError, load_config
from .models import RunResult
from .pinterest import TOKEN_ENV as PINTEREST_TOKEN_ENV
from .pinterest import PinterestConfig
from .runner import Runner, build_registry, run_once

EXIT_OK = 0
EXIT_INCOMPLETE = 1
EXIT_CONFIG_ERROR = 2


def setup_logging(verbosity: int) -> None:
    level = logging.WARNING if verbosity < 0 else logging.INFO if verbosity == 0 else logging.DEBUG
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="autobot",
        description="An autonomous agent that plans, acts and observes under a budget.",
    )
    parser.add_argument("-c", "--config", help="path to autobot.yaml (default: search cwd)")
    parser.add_argument("-v", "--verbose", action="count", default=0, help="more logging")
    parser.add_argument("-q", "--quiet", action="store_true", help="warnings and errors only")
    parser.add_argument(
        "--policy",
        help="override the configured policy ('rule' or 'claude')",
    )

    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="run a single task and exit")
    run.add_argument("task", help="name of the task to run")
    run.add_argument("--json", action="store_true", help="print the full run record as JSON")

    serve = sub.add_parser("serve", help="run enabled tasks on their intervals")
    serve.add_argument(
        "--max-cycles",
        type=int,
        default=None,
        help="stop after this many task runs (default: run until interrupted)",
    )

    sub.add_parser("tools", help="list available tools")
    sub.add_parser("tasks", help="list configured tasks")
    sub.add_parser("doctor", help="check config and credentials")
    return parser


def _load(args: argparse.Namespace) -> BotConfig:
    config = load_config(args.config)
    if args.policy:
        config.policy = args.policy
    return config


def _print_result(result: RunResult, as_json: bool) -> None:
    if as_json:
        print(json.dumps(result.to_dict(), indent=2, default=str))
        return
    print(f"\ntask:    {result.goal.name}")
    print(f"status:  {result.status}")
    print(f"steps:   {len(result.steps)} ({result.failures} failed)")
    print(f"summary: {result.summary or '(none)'}")


def cmd_run(config: BotConfig, args: argparse.Namespace) -> int:
    result = run_once(config, args.task)
    _print_result(result, getattr(args, "json", False))
    return EXIT_OK if result.ok else EXIT_INCOMPLETE


def cmd_serve(config: BotConfig, args: argparse.Namespace) -> int:
    runner = Runner(config)
    runner.install_signal_handlers()
    results = runner.serve(max_cycles=args.max_cycles)
    incomplete = [r for r in results if not r.ok]
    if incomplete:
        print(f"{len(incomplete)} of {len(results)} run(s) did not complete", file=sys.stderr)
    return EXIT_OK


def cmd_tools(config: BotConfig, _args: argparse.Namespace) -> int:
    registry = build_registry(config)
    print(f"{len(registry)} tool(s) available (policy: {config.policy})\n")
    for entry in registry:
        required = ", ".join(entry.schema.get("required", [])) or "-"
        flag = "  [dangerous]" if entry.dangerous else ""
        headline = entry.description.splitlines()[0] if entry.description else ""
        print(f"  {entry.name}{flag}\n      {headline}\n      required args: {required}")
    if not config.allow_dangerous_tools:
        print("\nDangerous tools are hidden. Set allow_dangerous_tools: true to enable them.")
    return EXIT_OK


def cmd_tasks(config: BotConfig, _args: argparse.Namespace) -> int:
    if not config.tasks:
        print("no tasks configured")
        return EXIT_OK
    for spec in config.tasks:
        state = "enabled " if spec.enabled else "disabled"
        mode = f"playbook ({len(spec.playbook)} steps)" if spec.playbook else "open-ended"
        print(f"  [{state}] {spec.name}  every {spec.interval_s:.0f}s  {mode}")
        print(f"            {spec.objective}")
    return EXIT_OK


def cmd_doctor(config: BotConfig, _args: argparse.Namespace) -> int:
    problems: list[str] = []
    print(f"policy:            {config.policy}")
    print(f"workspace:         {os.path.abspath(config.workspace)}")
    print(f"journal dir:       {os.path.abspath(config.journal_dir)}")
    print(f"tasks:             {len(config.enabled_tasks)} enabled / {len(config.tasks)} total")
    print(f"dangerous tools:   {'enabled' if config.allow_dangerous_tools else 'disabled'}")
    print(f"allowed domains:   {', '.join(config.allowed_domains) or '(any - unrestricted)'}")

    if not os.path.isdir(config.workspace):
        problems.append(f"workspace directory does not exist: {config.workspace}")
    if not config.allowed_domains:
        print("\nnote: http_get can reach any host; set allowed_domains to restrict it.")

    if config.policy.strip().lower() in {"claude", "llm", "anthropic"}:
        try:
            import anthropic  # noqa: F401
        except ImportError:
            problems.append("policy is 'claude' but the anthropic SDK is not installed")
        else:
            print(f"model:             {config.model} (effort: {config.effort})")
            # The SDK also accepts ANTHROPIC_AUTH_TOKEN or an `ant auth login`
            # profile, so a missing API key is a note rather than a failure.
            if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
                print(
                    "\nnote: no ANTHROPIC_API_KEY/ANTHROPIC_AUTH_TOKEN set; the SDK will "
                    "fall back to an `ant auth login` profile if one exists."
                )

    if config.pinterest or os.environ.get(PINTEREST_TOKEN_ENV):
        settings = PinterestConfig.from_bot_config(config)
        token = "set" if settings.access_token else f"MISSING ({PINTEREST_TOKEN_ENV} is unset)"
        print(f"\npinterest token:   {token}")
        print(f"pinterest mode:    {'DRY RUN - nothing is published' if settings.dry_run else 'LIVE - pins will be published publicly'}")
        print(f"pinterest api:     {settings.base_url}")
        print(f"pinterest cap:     {settings.max_pins_per_run} pin(s) per run")
        if not settings.access_token:
            problems.append(
                f"pinterest is configured but {PINTEREST_TOKEN_ENV} is unset; "
                "no Pinterest call can succeed"
            )
        if not settings.dry_run and not config.allow_dangerous_tools:
            problems.append(
                "pinterest.dry_run is false but allow_dangerous_tools is false, so "
                "pinterest_create_pin is not available - the bot cannot post either way"
            )

    rule_policy = config.policy.strip().lower() not in {"claude", "llm", "anthropic"}
    for spec in config.enabled_tasks:
        if rule_policy and not spec.playbook:
            problems.append(
                f"task '{spec.name}' has no playbook, but the rule policy needs one "
                "(it will finish immediately)"
            )

    if problems:
        print("\nproblems:")
        for problem in problems:
            print(f"  - {problem}")
        return EXIT_CONFIG_ERROR
    print("\nall checks passed")
    return EXIT_OK


COMMANDS = {
    "run": cmd_run,
    "serve": cmd_serve,
    "tools": cmd_tools,
    "tasks": cmd_tasks,
    "doctor": cmd_doctor,
}


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    setup_logging(-1 if args.quiet else args.verbose)
    try:
        config = _load(args)
    except ConfigError as exc:
        print(f"config error: {exc}", file=sys.stderr)
        return EXIT_CONFIG_ERROR

    try:
        return COMMANDS[args.command](config, args)
    except ConfigError as exc:
        print(f"config error: {exc}", file=sys.stderr)
        return EXIT_CONFIG_ERROR
    except KeyboardInterrupt:
        print("interrupted", file=sys.stderr)
        return EXIT_INCOMPLETE
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return EXIT_INCOMPLETE


if __name__ == "__main__":
    raise SystemExit(main())
