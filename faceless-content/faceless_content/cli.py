"""Command line entry point: ``python -m faceless_content.cli``."""

from __future__ import annotations

import argparse
import logging
import os
import shutil
import sys

from .config import Config, load_config
from .discovery import collect, rank
from .errors import PipelineError
from .pipeline import run
from .state import State
from .voice import select_backends
from .visuals import select_providers

logger = logging.getLogger("faceless_content")


def _configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(levelname)-7s %(name)s: %(message)s",
        stream=sys.stderr,
    )


def cmd_run(args: argparse.Namespace, cfg: Config) -> int:
    """Render (and optionally publish) one video."""
    if args.output:
        cfg.output_dir = args.output
    dry_run = not args.publish
    if dry_run and cfg.publish.targets:
        logger.info("dry run: rendering only. Pass --publish to post to %s", cfg.publish.targets)

    result = run(cfg, dry_run=dry_run, topic_override=args.topic, summary_override=args.summary)

    print(f"topic:    {result.topic}")
    print(f"title:    {result.title}")
    print(f"video:    {result.video_path}")
    print(f"duration: {result.duration:.1f}s")
    print(f"voice:    {result.voice_backend}")
    print(f"script:   {result.script.writer} ({result.script.word_count()} words)")
    for publish_result in result.publish_results:
        print(f"publish:  {publish_result}")
    return 0 if all(r.ok for r in result.publish_results) else 1


def cmd_trends(args: argparse.Namespace, cfg: Config) -> int:
    """Show what discovery would pick, without producing anything."""
    per_source = collect(cfg.discovery)
    if not per_source:
        print("no discovery source returned anything", file=sys.stderr)
        return 1
    state = State(cfg.state_path) if args.apply_cooldown else None
    topics = rank(cfg.discovery, per_source, state, tuple(cfg.blocklist_extra))
    if not topics:
        print("every candidate was filtered out", file=sys.stderr)
        return 1
    width = max(len(t.title[:60]) for t in topics[: args.limit])
    for index, topic in enumerate(topics[: args.limit], start=1):
        print(f"{index:2d}. {topic.score:5.2f}  {topic.title[:60]:<{width}}  [{', '.join(topic.sources)}]")
    return 0


def cmd_doctor(args: argparse.Namespace, cfg: Config) -> int:
    """Report what is installed and configured, and what that means for a run."""
    ok = True

    print("binaries:")
    for binary in (cfg.render.ffmpeg_bin, cfg.render.ffprobe_bin):
        path = shutil.which(binary)
        print(f"  {binary:10s} {path or 'MISSING - install ffmpeg'}")
        ok = ok and path is not None

    print("script writer:")
    if os.environ.get("ANTHROPIC_API_KEY"):
        print(f"  anthropic ({cfg.script.model})")
    else:
        print("  template fallback (set ANTHROPIC_API_KEY for model-written scripts)")

    voice = [b.name for b in select_backends(cfg.voice)]
    print(f"voice backends: {', '.join(voice) if voice else 'NONE - install espeak-ng or set a key'}")
    ok = ok and bool(voice)

    visuals = [p.name for p in select_providers(cfg.visuals)]
    print(f"visuals providers: {', '.join(visuals) if visuals else 'NONE'}")
    ok = ok and bool(visuals)

    print(f"discovery sources: {', '.join(cfg.discovery.sources)}")

    print("publish targets:")
    if not cfg.publish.targets:
        print("  (none configured - render only)")
    else:
        from .publish import build_targets

        for target in build_targets(cfg.publish):
            missing = target.missing_env()
            print(f"  {target.name:10s} {'ready' if not missing else 'missing ' + ', '.join(missing)}")

    print(f"\n{'ready to run' if ok else 'NOT ready - see MISSING/NONE above'}")
    return 0 if ok else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="faceless-content",
        description="Autonomously produce and publish faceless short-form videos.",
    )
    parser.add_argument("-c", "--config", help="path to a YAML or JSON config file")
    parser.add_argument("-v", "--verbose", action="store_true", help="debug logging")
    subparsers = parser.add_subparsers(dest="command", required=True)

    run_parser = subparsers.add_parser("run", help="produce one video")
    run_parser.add_argument("--topic", help="skip discovery and use this topic")
    run_parser.add_argument("--summary", default="", help="context for --topic")
    run_parser.add_argument("--output", help="override output_dir")
    run_parser.add_argument(
        "--publish",
        action="store_true",
        help="actually post to the configured targets (default: render only)",
    )
    run_parser.set_defaults(func=cmd_run)

    trends_parser = subparsers.add_parser("trends", help="show ranked topic candidates")
    trends_parser.add_argument("-n", "--limit", type=int, default=15)
    trends_parser.add_argument(
        "--apply-cooldown",
        action="store_true",
        help="also filter out topics already covered recently",
    )
    trends_parser.set_defaults(func=cmd_trends)

    doctor_parser = subparsers.add_parser("doctor", help="check the local setup")
    doctor_parser.set_defaults(func=cmd_doctor)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    _configure_logging(args.verbose)
    try:
        cfg = load_config(args.config)
        return args.func(args, cfg)
    except PipelineError as exc:
        logger.error("%s", exc)
        return 1
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
