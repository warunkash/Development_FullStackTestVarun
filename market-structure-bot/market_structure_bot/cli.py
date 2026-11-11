"""Command-line entrypoint for the market-structure bot.

Examples
--------
Structure and breaks for one symbol on the 5m chart::

    python -m market_structure_bot.cli --symbol TATAPOWER

Sweep a watchlist for symbols that just broke structure::

    python -m market_structure_bot.cli --scan --max-age-bars 3

Keep sweeping every 5 minutes while NSE is open, alerting only on new breaks::

    python -m market_structure_bot.cli --scan --watch --interval-seconds 300
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import sys
import time
from pathlib import Path

from .candles import CandleError
from .market_hours import is_market_open, now_ist
from .signals import Analysis
from .watchlist import ScanResult, analyze_symbol, fresh_signals, load_symbols, scan

logger = logging.getLogger("market_structure_bot")

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"

_TREND_MARK = {"uptrend": "UP", "downtrend": "DOWN", "range": "RANGE"}


def _table(headers: list[str], rows: list[list[str]]) -> str:
    if not rows:
        return ""
    widths = [max(len(h), *(len(r[i]) for r in rows)) for i, h in enumerate(headers)]
    head = "  ".join(h.ljust(w) for h, w in zip(headers, widths))
    body = "\n".join("  ".join(c.ljust(w) for c, w in zip(r, widths)) for r in rows)
    return f"{head}\n{'-' * len(head)}\n{body}"


def _print_structure(analysis: Analysis, pivot_limit: int) -> None:
    price = analysis.last_price
    last_bar = analysis.candles[-1].time_ist.strftime("%Y-%m-%d %H:%M")
    print(
        f"\n{analysis.symbol}  {analysis.interval}  "
        f"last {price:.2f}  trend {_TREND_MARK.get(analysis.trend, analysis.trend)}  "
        f"(last closed bar {last_bar} IST)"
    )

    pivots = analysis.structure.pivots[-pivot_limit:]
    if pivots:
        print("\nSwing structure (most recent last):")
        print(
            _table(
                ["Time (IST)", "Swing", "Label", "Price"],
                [
                    [p.time_ist.strftime("%d %b %H:%M"), p.kind.upper(), p.label, f"{p.price:.2f}"]
                    for p in pivots
                ],
            )
        )
    else:
        print("\nNo confirmed swing points yet — try a longer --lookback or smaller --depth.")

    if analysis.signals:
        print("\nStructure breaks:")
        print(
            _table(
                ["Time (IST)", "Type", "Dir", "Broke", "Level", "Close", "Slip",
                 "Stop", "Target", "Risk"],
                [
                    [
                        s.time_ist.strftime("%d %b %H:%M"),
                        s.kind,
                        s.direction,
                        s.level_label,
                        f"{s.level:.2f}",
                        f"{s.price:.2f}",
                        f"{s.slip_pct:.2f}%",
                        f"{s.stop:.2f}" if s.stop is not None else "-",
                        f"{s.target:.2f}" if s.target is not None else "-",
                        f"{s.risk_pct:.2f}%" if s.risk_pct is not None else "-",
                    ]
                    for s in analysis.signals[-pivot_limit:]
                ],
            )
        )
        age = analysis.bars_since_last_signal()
        print(f"\nLatest: {analysis.last_signal.describe()}  ({age} bar(s) ago)")
    else:
        print("\nNo structure breaks in the loaded window.")


def _print_scan(results: list[ScanResult], max_age_bars: int) -> list[ScanResult]:
    hits = fresh_signals(results, max_age_bars=max_age_bars)
    failed = [r for r in results if r.error]

    if hits:
        rows = []
        for r in hits:
            s = r.analysis.last_signal
            rows.append(
                [
                    r.symbol,
                    s.kind,
                    s.direction,
                    f"{r.analysis.bars_since_last_signal()}",
                    f"{s.level:.2f}",
                    f"{s.price:.2f}",
                    f"{r.analysis.last_price:.2f}",
                    f"{s.stop:.2f}" if s.stop is not None else "-",
                    f"{s.target:.2f}" if s.target is not None else "-",
                    s.time_ist.strftime("%d %b %H:%M"),
                ]
            )
        print(
            _table(
                ["Symbol", "Type", "Dir", "Bars", "Level", "Close", "Now", "Stop", "Target", "Time (IST)"],
                rows,
            )
        )
        print(f"\n{len(hits)} symbol(s) broke structure within the last {max_age_bars} bar(s).")
    else:
        print(f"No structure breaks in the last {max_age_bars} bar(s) across {len(results)} symbol(s).")

    if failed:
        print(f"\n{len(failed)} symbol(s) could not be scanned: " + ", ".join(r.symbol for r in failed))
    return hits


def _signal_rows(results: list[ScanResult]) -> list[dict]:
    rows = []
    for r in results:
        if r.analysis is None or not r.analysis.signals:
            continue
        s = r.analysis.last_signal
        rows.append(
            {
                "symbol": r.symbol,
                "interval": r.analysis.interval,
                "time_ist": s.time_ist.isoformat(),
                "kind": s.kind,
                "direction": s.direction,
                "level_broken": round(s.level, 2),
                "level_label": s.level_label,
                "close": round(s.price, 2),
                "slip_pct": round(s.slip_pct, 3),
                "last_price": round(r.analysis.last_price, 2),
                "stop": round(s.stop, 2) if s.stop is not None else None,
                "target": round(s.target, 2) if s.target is not None else None,
                "risk_pct": round(s.risk_pct, 2) if s.risk_pct is not None else None,
                "bars_ago": r.analysis.bars_since_last_signal(),
                "trend": r.analysis.trend,
            }
        )
    return rows


def _write_output(rows: list[dict], out: str) -> None:
    path = Path(out)
    if path.is_dir() or out.endswith("/"):
        stamp = now_ist().strftime("%Y%m%d-%H%M%S")
        path = path / f"signals-{stamp}.csv"
    path.parent.mkdir(parents=True, exist_ok=True)

    if path.suffix == ".json":
        path.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    else:
        fields = list(rows[0].keys()) if rows else ["symbol"]
        with path.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)
    logger.info("Wrote %d row(s) to %s", len(rows), path)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="market_structure_bot",
        description="Market-structure bot: swing labels (HH/HL/LH/LL) and BOS/CHoCH alerts.",
    )
    target = p.add_argument_group("what to look at")
    target.add_argument("--symbol", help="single NSE symbol, e.g. TATAPOWER")
    target.add_argument("--scan", action="store_true", help="sweep a watchlist instead of one symbol")
    target.add_argument("--symbols", help="comma-separated watchlist for --scan")
    target.add_argument("--symbols-file", help="file with one symbol per line for --scan")
    target.add_argument("--interval", default="5m", help="candle interval (default: 5m)")
    target.add_argument("--lookback", default="1mo", help="history to load (default: 1mo)")

    tuning = p.add_argument_group("structure tuning")
    tuning.add_argument("--depth", type=int, default=3,
                        help="bars either side of a swing point (default: 3)")
    tuning.add_argument("--min-swing-pct", type=float, default=0.0,
                        help="ignore swings smaller than this %% move (default: 0 = off)")
    tuning.add_argument("--reward-multiple", type=float, default=2.0,
                        help="target as a multiple of risk (default: 2.0)")
    tuning.add_argument("--use-wicks", action="store_true",
                        help="break on wicks instead of closes (earlier, noisier)")
    tuning.add_argument("--include-forming", action="store_true",
                        help="include the still-forming bar (its high/low can still change)")

    output = p.add_argument_group("output")
    output.add_argument("--max-age-bars", type=int, default=3,
                        help="--scan: only report breaks this recent (default: 3)")
    output.add_argument("--kinds", default="BOS,CHoCH",
                        help="signal types to report (default: BOS,CHoCH)")
    output.add_argument("--limit", type=int, default=12,
                        help="rows of structure/signal history to print (default: 12)")
    output.add_argument("--json", action="store_true", help="print JSON instead of tables")
    output.add_argument("--out", help="write results to a CSV/JSON file or directory")
    output.add_argument("--workers", type=int, default=8, help="concurrent fetches (default: 8)")

    loop = p.add_argument_group("watch mode")
    loop.add_argument("--watch", action="store_true", help="re-run on an interval")
    loop.add_argument("--interval-seconds", type=int, default=300,
                      help="seconds between passes in --watch (default: 300)")
    loop.add_argument("--force", action="store_true", help="run even when NSE looks closed")
    p.add_argument("-v", "--verbose", action="store_true", help="debug logging")
    return p


def _analysis_json(analysis: Analysis) -> dict:
    return {
        "symbol": analysis.symbol,
        "interval": analysis.interval,
        "trend": analysis.trend,
        "last_price": round(analysis.last_price, 2) if analysis.last_price else None,
        "pivots": [
            {"time_ist": p.time_ist.isoformat(), "kind": p.kind,
             "label": p.label, "price": round(p.price, 2)}
            for p in analysis.structure.pivots
        ],
        "signals": [
            {"time_ist": s.time_ist.isoformat(), "kind": s.kind, "direction": s.direction,
             "level": round(s.level, 2), "level_label": s.level_label,
             "close": round(s.price, 2), "slip_pct": round(s.slip_pct, 3),
             "stop": round(s.stop, 2) if s.stop is not None else None,
             "target": round(s.target, 2) if s.target is not None else None}
            for s in analysis.signals
        ],
    }


def _run_once(args: argparse.Namespace, seen: set[tuple[str, int]]) -> int:
    common = dict(
        interval=args.interval,
        lookback=args.lookback,
        depth=args.depth,
        min_swing_pct=args.min_swing_pct,
        reward_multiple=args.reward_multiple,
        use_wicks=args.use_wicks,
        include_forming=args.include_forming,
    )

    if args.scan:
        symbols = load_symbols(args.symbols, args.symbols_file)
        logger.info("Scanning %d symbol(s) on the %s chart", len(symbols), args.interval)
        results = scan(symbols, workers=args.workers, **common)
        kinds = {k.strip() for k in args.kinds.split(",") if k.strip()}
        hits = fresh_signals(results, max_age_bars=args.max_age_bars, kinds=kinds)

        if args.watch:
            # Only announce breaks this loop has not already announced.
            new_hits = [h for h in hits if (h.symbol, h.analysis.last_signal.epoch) not in seen]
            for h in new_hits:
                seen.add((h.symbol, h.analysis.last_signal.epoch))
            if not new_hits:
                print(f"[{now_ist():%H:%M:%S}] no new breaks ({len(results)} scanned)")
                return 0
            hits = new_hits
            print(f"[{now_ist():%H:%M:%S}] {len(hits)} new break(s):")

        if args.json:
            print(json.dumps(_signal_rows(hits), indent=2))
        elif args.watch:
            for h in hits:
                print(f"  {h.symbol:<12} {h.analysis.last_signal.describe()}")
        else:
            _print_scan(results, args.max_age_bars)

        if args.out:
            _write_output(_signal_rows(hits), args.out)
        return 0

    try:
        analysis = analyze_symbol(args.symbol, **common)
    except CandleError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(_analysis_json(analysis), indent=2))
    else:
        _print_structure(analysis, args.limit)
    if args.out:
        _write_output(_signal_rows([ScanResult(analysis.symbol, analysis)]), args.out)
    return 0


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    if not args.scan and not args.symbol:
        print("error: pass --symbol SYMBOL or --scan", file=sys.stderr)
        return 2
    if args.depth < 1:
        print("error: --depth must be at least 1", file=sys.stderr)
        return 2

    if not args.watch:
        return _run_once(args, set())

    # Piping a long-running loop to a log file otherwise block-buffers its
    # output, so a cron'd --watch looks dead for hours at a time.
    sys.stdout.reconfigure(line_buffering=True)

    seen: set[tuple[str, int]] = set()
    print(
        f"Watching every {args.interval_seconds}s on the {args.interval} chart. Ctrl-C to stop."
    )
    try:
        while True:
            if is_market_open() or args.force:
                _run_once(args, seen)
            else:
                print(f"[{now_ist():%H:%M:%S}] NSE closed — skipping (use --force to override)")
            time.sleep(args.interval_seconds)
    except KeyboardInterrupt:
        print("\nStopped.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
