"""Command-line entrypoint for the Nifty 500 mover screener.

Examples
--------
Scan live prices right now (intraday mode)::

    python -m nifty500_screener.cli --mode intraday

Scan the latest official close vs. the prior close (end-of-day mode)::

    python -m nifty500_screener.cli --mode eod

Re-scan every 5 minutes while the market is open, writing a fresh CSV
each time::

    python -m nifty500_screener.cli --mode intraday --watch --interval 300 --out output/
"""

from __future__ import annotations

import argparse
import csv
import logging
import sys
import time
from pathlib import Path

from . import screener
from .constituents import fetch_nifty500_constituents
from .market_hours import is_market_open, now_ist
from .screener import Mover

logger = logging.getLogger("nifty500_screener")

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"


def _print_table(movers: list[Mover], min_pct: float, max_pct: float) -> None:
    if not movers:
        print(f"No Nifty 500 stocks moved {min_pct:.0f}%-{max_pct:.0f}% today.")
        return

    headers = ["Symbol", "Company", "Dir", "% Chg", "Prev Close", "Current", "As of (IST)"]
    rows = []
    for m in movers:
        rows.append(
            [
                m.symbol,
                (m.company_name[:28] + "…") if len(m.company_name) > 29 else m.company_name,
                m.direction,
                f"{m.pct_change:+.2f}%",
                f"{m.reference_price:.2f}",
                f"{m.current_price:.2f}",
                m.as_of.astimezone(now_ist().tzinfo).strftime("%Y-%m-%d %H:%M:%S"),
            ]
        )
    widths = [max(len(h), *(len(r[i]) for r in rows)) for i, h in enumerate(headers)]
    line = "  ".join(h.ljust(w) for h, w in zip(headers, widths))
    print(line)
    print("-" * len(line))
    for r in rows:
        print("  ".join(c.ljust(w) for c, w in zip(r, widths)))
    print(f"\n{len(movers)} stock(s) in the {min_pct:.0f}%-{max_pct:.0f}% band.")


def _write_csv(movers: list[Mover], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(
            ["symbol", "company_name", "industry", "direction", "pct_change",
             "previous_close", "current_price", "as_of_utc"]
        )
        for m in movers:
            writer.writerow(
                [m.symbol, m.company_name, m.industry, m.direction,
                 f"{m.pct_change:.2f}", m.reference_price, m.current_price,
                 m.as_of.isoformat()]
            )
    logger.info("Wrote %d rows to %s", len(movers), path)


def run_once(args: argparse.Namespace) -> list[Mover]:
    constituents = fetch_nifty500_constituents(refresh=args.refresh_list)
    logger.info("Loaded %d Nifty 500 constituents", len(constituents))

    if args.mode == "intraday" and not is_market_open() and not args.force:
        print(
            "NSE market is currently closed (open Mon-Fri 09:15-15:30 IST). "
            "Live prices would reflect the last close. Pass --force to scan anyway, "
            "or use --mode eod for end-of-day analysis.",
            file=sys.stderr,
        )
        return []

    scan_fn = screener.screen_intraday if args.mode == "intraday" else screener.screen_eod
    movers, errors = scan_fn(
        constituents, min_pct=args.min_pct, max_pct=args.max_pct, max_workers=args.workers
    )
    if errors:
        logger.warning("%d symbol(s) failed to fetch (showing first 10): %s",
                        len(errors), "; ".join(errors[:10]))

    _print_table(movers, args.min_pct, args.max_pct)

    if args.out:
        out_path = Path(args.out)
        if out_path.is_dir() or args.out.endswith("/"):
            ts = now_ist().strftime("%Y%m%d_%H%M%S")
            out_path = out_path / f"nifty500_{args.mode}_{ts}.csv"
        _write_csv(movers, out_path)

    return movers


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="nifty500-screener",
        description="Screen Nifty 500 stocks that surged or plunged 15%-20% in a day.",
    )
    parser.add_argument(
        "--mode", choices=["intraday", "eod"], default="intraday",
        help="intraday = live price vs previous close; eod = latest official close vs prior close",
    )
    parser.add_argument("--min-pct", type=float, default=15.0, help="lower bound of the move band (default 15)")
    parser.add_argument("--max-pct", type=float, default=20.0, help="upper bound of the move band (default 20)")
    parser.add_argument("--workers", type=int, default=20, help="concurrent HTTP requests (default 20)")
    parser.add_argument("--out", type=str, default=str(OUTPUT_DIR) + "/",
                         help="CSV output path or directory (default: output/, timestamped file). Pass '' to skip.")
    parser.add_argument("--refresh-list", action="store_true", help="force re-download of the Nifty 500 constituent list")
    parser.add_argument("--force", action="store_true", help="run intraday scan even if the market is currently closed")
    parser.add_argument("--watch", action="store_true", help="repeat the scan on an interval (intraday mode)")
    parser.add_argument("--interval", type=int, default=300, help="seconds between scans in --watch mode (default 300)")
    parser.add_argument("-v", "--verbose", action="store_true", help="enable debug logging")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    if args.min_pct > args.max_pct:
        parser.error("--min-pct cannot be greater than --max-pct")

    if not args.watch:
        run_once(args)
        return 0

    if args.mode != "intraday":
        parser.error("--watch is only meaningful with --mode intraday")

    print(f"Watching every {args.interval}s while the market is open. Ctrl+C to stop.")
    try:
        while True:
            if is_market_open() or args.force:
                run_once(args)
            else:
                print(f"[{now_ist():%H:%M:%S}] Market closed, waiting...")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nStopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
