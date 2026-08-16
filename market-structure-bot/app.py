"""Streamlit dashboard for the market-structure bot.

Draws the same thing the bot reasons about: candles, the zig-zag between
confirmed swings, HH/HL/LH/LL labels, and markers where structure broke.

    streamlit run app.py
"""

from __future__ import annotations

import time

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from market_structure_bot.candles import CandleError
from market_structure_bot.market_hours import is_market_open, now_ist
from market_structure_bot.signals import BULLISH
from market_structure_bot.structure import DOWNTREND, HIGH, UPTREND
from market_structure_bot.watchlist import (
    DEFAULT_WATCHLIST,
    analyze_symbol,
    fresh_signals,
    scan,
)

UP = "#26a69a"
DOWN = "#ef5350"
BULL_LABEL = "#4caf50"
BEAR_LABEL = "#e53935"
PAPER = "#131722"
GRID = "#2a2e39"

st.set_page_config(page_title="Market Structure Bot", page_icon="📈", layout="wide")


@st.cache_data(ttl=60, show_spinner=False)
def load_analysis(symbol: str, interval: str, lookback: str, depth: int,
                  min_swing_pct: float, reward_multiple: float, use_wicks: bool):
    return analyze_symbol(
        symbol, interval=interval, lookback=lookback, depth=depth,
        min_swing_pct=min_swing_pct, reward_multiple=reward_multiple,
        use_wicks=use_wicks,
    )


@st.cache_data(ttl=60, show_spinner=False)
def load_scan(symbols: tuple[str, ...], interval: str, lookback: str, depth: int,
              min_swing_pct: float, reward_multiple: float, use_wicks: bool):
    return scan(
        list(symbols), interval=interval, lookback=lookback, depth=depth,
        min_swing_pct=min_swing_pct, reward_multiple=reward_multiple,
        use_wicks=use_wicks,
    )


#: Signals older than this many are drawn as a plain level line with no label,
#: so a month of history does not bury the chart under overlapping badges.
LABELLED_SIGNALS = 6


def _range_breaks(interval: str) -> list[dict]:
    """Collapse the time axis over periods where NSE does not trade.

    Without this the overnight gap (15:30-09:15) eats most of the horizontal
    space and each session shrinks to a narrow clump of candles.
    """
    breaks = [dict(bounds=["sat", "mon"])]
    if interval.endswith(("m", "h")):
        breaks.append(dict(bounds=[15.5, 9.25], pattern="hour"))
    return breaks


def structure_figure(analysis, bars: int) -> go.Figure:
    candles = analysis.candles[-bars:]
    first_index = len(analysis.candles) - len(candles)
    times = [c.time_ist for c in candles]

    fig = go.Figure(
        go.Candlestick(
            x=times,
            open=[c.open for c in candles],
            high=[c.high for c in candles],
            low=[c.low for c in candles],
            close=[c.close for c in candles],
            increasing_line_color=UP, increasing_fillcolor=UP,
            decreasing_line_color=DOWN, decreasing_fillcolor=DOWN,
            name=analysis.symbol,
        )
    )

    pivots = [p for p in analysis.structure.pivots if p.index >= first_index]
    if pivots:
        # The zig-zag is coloured by leg direction: rising legs green, falling red.
        for a, b in zip(pivots, pivots[1:]):
            rising = b.price > a.price
            fig.add_trace(
                go.Scatter(
                    x=[a.time_ist, b.time_ist], y=[a.price, b.price],
                    mode="lines", line=dict(color=UP if rising else DOWN, width=1.6),
                    hoverinfo="skip", showlegend=False,
                )
            )
        for p in pivots:
            above = p.kind == HIGH
            fig.add_annotation(
                x=p.time_ist, y=p.price, text=f"<b>{p.label}</b>",
                showarrow=False, yshift=14 if above else -14,
                font=dict(size=11, color=BULL_LABEL if p.label in ("HH", "HL") else BEAR_LABEL),
            )

    visible = [s for s in analysis.signals if s.index >= first_index]
    for position, s in enumerate(reversed(visible)):
        bullish = s.direction == BULLISH
        colour = BULL_LABEL if bullish else BEAR_LABEL
        broken_at = analysis.candles[s.index].time_ist

        # The level line runs from the swing that made it to the bar that broke
        # it, rather than spanning the whole chart, so overlapping levels stay
        # readable.
        fig.add_shape(
            type="line", x0=s.level_time_ist, x1=broken_at, y0=s.level, y1=s.level,
            line=dict(color=colour, width=1, dash="dot"),
        )
        if position < LABELLED_SIGNALS:
            fig.add_annotation(
                x=broken_at, y=s.price,
                text=f"<b>{s.kind}</b>", showarrow=True, arrowhead=2, arrowsize=1,
                arrowcolor=colour, ay=40 if bullish else -40,
                font=dict(size=11, color="#ffffff"), bgcolor=colour,
            )

    fig.update_layout(
        height=620, margin=dict(l=8, r=8, t=8, b=8),
        paper_bgcolor=PAPER, plot_bgcolor=PAPER, font=dict(color="#d1d4dc"),
        xaxis_rangeslider_visible=False, showlegend=False,
        xaxis=dict(gridcolor=GRID, rangebreaks=_range_breaks(analysis.interval)),
        yaxis=dict(gridcolor=GRID, side="right"),
    )
    return fig


def signal_frame(analysis) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "Time (IST)": s.time_ist.strftime("%d %b %H:%M"),
                "Type": s.kind,
                "Direction": s.direction,
                "Broke": f"{s.level_label} @ {s.level:.2f}",
                "Close": round(s.price, 2),
                "Slip %": round(s.slip_pct, 3),
                "Stop": round(s.stop, 2) if s.stop is not None else None,
                "Target": round(s.target, 2) if s.target is not None else None,
                "Risk %": round(s.risk_pct, 2) if s.risk_pct is not None else None,
            }
            for s in reversed(analysis.signals)
        ]
    )


st.title("📈 Market Structure Bot")

with st.sidebar:
    st.header("Chart")
    mode = st.radio("Mode", ["Single symbol", "Watchlist scan"], horizontal=False)
    interval = st.selectbox("Interval", ["5m", "15m", "30m", "1h", "1d"], index=0)
    lookback = st.selectbox("Lookback", ["5d", "1mo", "60d"], index=1)

    st.header("Structure")
    depth = st.slider("Swing depth (bars either side)", 1, 10, 3,
                      help="Higher = fewer, more significant swings.")
    min_swing_pct = st.slider("Min swing size (%)", 0.0, 5.0, 0.0, 0.1,
                              help="Drop legs smaller than this. 0 = keep every fractal.")
    reward_multiple = st.slider("Target (× risk)", 1.0, 5.0, 2.0, 0.5)
    use_wicks = st.checkbox("Break on wicks (not closes)", value=False)

    st.caption(
        "Signals are confirmed **{} bars late** — a swing is only valid once "
        "{} more bars have printed beyond it.".format(depth, depth)
    )

open_now = is_market_open()
st.caption(
    ("🟢 NSE open" if open_now else "🔴 NSE closed")
    + f" — {now_ist():%d %b %Y %H:%M:%S} IST"
)

if mode == "Single symbol":
    col_sym, col_bars = st.columns([1, 2])
    symbol = col_sym.text_input("Symbol (NSE)", value="TATAPOWER").strip().upper()
    bars = col_bars.slider("Bars to plot", 50, 800, 300, 10)

    if symbol:
        try:
            analysis = load_analysis(
                symbol, interval, lookback, depth, min_swing_pct, reward_multiple, use_wicks
            )
        except CandleError as exc:
            st.error(f"Could not load {symbol}: {exc}")
            st.stop()

        trend_badge = {UPTREND: "🟢 Uptrend", DOWNTREND: "🔴 Downtrend"}.get(
            analysis.trend, "⚪ Range"
        )
        last = analysis.last_signal
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Last price", f"{analysis.last_price:.2f}")
        m2.metric("Structure", trend_badge)
        m3.metric("Swings found", len(analysis.structure.pivots))
        m4.metric(
            "Last break",
            f"{last.kind} {last.direction}" if last else "—",
            f"{analysis.bars_since_last_signal()} bars ago" if last else None,
        )

        st.plotly_chart(structure_figure(analysis, bars), width="stretch")

        if analysis.signals:
            st.subheader("Structure breaks")
            frame = signal_frame(analysis)
            st.dataframe(frame, width="stretch", hide_index=True)
            st.download_button(
                "Download CSV",
                frame.to_csv(index=False).encode("utf-8"),
                file_name=f"{symbol}-{interval}-signals.csv",
                mime="text/csv",
            )
        else:
            st.info("No structure breaks in this window.")

else:
    raw = st.text_area(
        "Watchlist (one symbol per line)",
        value="\n".join(DEFAULT_WATCHLIST),
        height=140,
    )
    symbols = tuple(s.strip().upper() for s in raw.splitlines() if s.strip())
    max_age = st.slider("Only show breaks from the last N bars", 1, 20, 3)

    if st.button("Scan", type="primary") or symbols:
        with st.spinner(f"Scanning {len(symbols)} symbol(s)…"):
            results = load_scan(
                symbols, interval, lookback, depth, min_swing_pct, reward_multiple, use_wicks
            )
        hits = fresh_signals(results, max_age_bars=max_age)

        if hits:
            rows = []
            for r in hits:
                s = r.analysis.last_signal
                rows.append(
                    {
                        "Symbol": r.symbol,
                        "Type": s.kind,
                        "Direction": s.direction,
                        "Bars ago": r.analysis.bars_since_last_signal(),
                        "Broke": f"{s.level_label} @ {s.level:.2f}",
                        "Close": round(s.price, 2),
                        "Now": round(r.analysis.last_price, 2),
                        "Stop": round(s.stop, 2) if s.stop is not None else None,
                        "Target": round(s.target, 2) if s.target is not None else None,
                        "Trend": r.analysis.trend,
                    }
                )
            st.dataframe(pd.DataFrame(rows), width="stretch", hide_index=True)
        else:
            st.info(f"Nothing broke structure in the last {max_age} bar(s).")

        failed = [r for r in results if r.error]
        if failed:
            st.warning("Could not scan: " + ", ".join(r.symbol for r in failed))

    if st.checkbox("Auto-refresh every 60s", value=False):
        # Single-user dashboard: this blocks the session, which is the right
        # shape for one person watching the market during the day.
        time.sleep(60)
        st.cache_data.clear()
        st.rerun()

st.caption(
    "Screening and research only. Prices come from Yahoo Finance's unofficial "
    "endpoint and are typically delayed a few minutes — not a source of truth "
    "for trading decisions."
)
