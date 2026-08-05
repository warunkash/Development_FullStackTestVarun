"""Streamlit dashboard for the Nifty 500 daily mover screener.

Run with:

    streamlit run app.py

Shows Nifty 500 stocks that surged or plunged within a configurable
percentage band (default 15%-20%), in either Intraday (live vs previous
close) or End of Day (latest close vs prior close) mode.
"""

from __future__ import annotations

import time

import pandas as pd
import streamlit as st

from nifty500_screener import screener
from nifty500_screener.constituents import fetch_nifty500_constituents
from nifty500_screener.market_hours import is_market_open, now_ist
from nifty500_screener.screener import Mover

st.set_page_config(page_title="Nifty 500 Mover Screener", page_icon="\U0001F4C8", layout="wide")


@st.cache_data(ttl=24 * 3600, show_spinner=False)
def load_constituents(_cache_bust: int = 0):
    return fetch_nifty500_constituents()


def movers_to_frame(movers: list[Mover]) -> pd.DataFrame:
    ist = now_ist().tzinfo
    return pd.DataFrame(
        [
            {
                "Symbol": m.symbol,
                "Company": m.company_name,
                "Industry": m.industry,
                "Direction": m.direction,
                "% Change": round(m.pct_change, 2),
                "Prev Close": m.reference_price,
                "Current": m.current_price,
                "As of (IST)": m.as_of.astimezone(ist).strftime("%Y-%m-%d %H:%M:%S"),
            }
            for m in movers
        ]
    )


def style_direction(row: pd.Series) -> list[str]:
    color = "#1a7f37" if row["Direction"] == "SURGE" else "#cf222e"
    return [f"color: {color}; font-weight: 600"] * len(row)


# ---------------------------------------------------------------- sidebar --
st.sidebar.header("Screener settings")
mode_label = st.sidebar.radio("Mode", ["Intraday", "End of Day"], index=0)
mode = "intraday" if mode_label == "Intraday" else "eod"

min_pct, max_pct = st.sidebar.slider(
    "Daily move band (%)", min_value=0.0, max_value=50.0, value=(15.0, 20.0), step=0.5
)
workers = st.sidebar.slider("Concurrent requests", min_value=5, max_value=50, value=25, step=5)

st.sidebar.divider()
auto_refresh = st.sidebar.checkbox(
    "Auto-refresh while market is open", value=False,
    help="Only applies to Intraday mode; re-scans on the interval below.",
)
interval = st.sidebar.number_input(
    "Refresh interval (seconds)", min_value=30, max_value=1800, value=300, step=30
)

force_list_refresh = st.sidebar.button("Force refresh Nifty 500 list")
run_clicked = st.sidebar.button("Run scan now", type="primary")

st.sidebar.divider()
st.sidebar.caption(
    "Data: NSE archives (constituents) + Yahoo Finance (prices, delayed a few "
    "minutes). Screening/research use only, not investment advice."
)

# ------------------------------------------------------------------ header --
st.title("\U0001F4C8 Nifty 500 Daily Mover Screener")

market_open = is_market_open()
status_badge = "\U0001F7E2 Market OPEN" if market_open else "\U0001F534 Market CLOSED"
st.caption(f"{status_badge} · {now_ist():%A, %d %b %Y %H:%M:%S} IST")

if mode == "intraday" and not market_open:
    st.warning(
        "NSE looks closed right now (open Mon-Fri 09:15-15:30 IST). Live prices "
        "will just reflect the last close. Switch to **End of Day** mode for a "
        "proper close-to-close comparison, or run anyway."
    )

# -------------------------------------------------------------- run logic --
if "movers" not in st.session_state:
    st.session_state.movers = None
    st.session_state.errors: list[str] = []
    st.session_state.last_run = None
    st.session_state.list_refresh_token = 0

if force_list_refresh:
    st.session_state.list_refresh_token += 1

should_run = run_clicked or st.session_state.movers is None or (auto_refresh and mode == "intraday")

if should_run:
    with st.spinner("Loading Nifty 500 constituents..."):
        constituents = load_constituents(st.session_state.list_refresh_token)
    with st.spinner(f"Scanning {len(constituents)} Nifty 500 stocks ({mode_label})..."):
        scan_fn = screener.screen_intraday if mode == "intraday" else screener.screen_eod
        movers, errors = scan_fn(constituents, min_pct=min_pct, max_pct=max_pct, max_workers=workers)
    st.session_state.movers = movers
    st.session_state.errors = errors
    st.session_state.last_run = now_ist()

movers: list[Mover] = st.session_state.movers or []
errors: list[str] = st.session_state.errors
last_run = st.session_state.last_run

surges = [m for m in movers if m.direction == "SURGE"]
plunges = [m for m in movers if m.direction == "PLUNGE"]

col1, col2, col3, col4 = st.columns(4)
col1.metric("Total movers", len(movers))
col2.metric("Surges ▲", len(surges))
col3.metric("Plunges ▼", len(plunges))
col4.metric("Last scan", last_run.strftime("%H:%M:%S") if last_run else "—")

if errors:
    with st.expander(f"⚠️ {len(errors)} symbol(s) failed to fetch"):
        st.code("\n".join(errors))

# ------------------------------------------------------------------ table --
if not movers:
    if last_run is not None:
        st.info(f"No Nifty 500 stocks moved {min_pct:.1f}%–{max_pct:.1f}% as of the last scan.")
else:
    df = movers_to_frame(movers)
    st.dataframe(
        df.style.apply(style_direction, axis=1).format({"Prev Close": "{:.2f}", "Current": "{:.2f}", "% Change": "{:+.2f}"}),
        use_container_width=True,
        hide_index=True,
    )

    chart_df = df.set_index("Symbol")["% Change"]
    st.bar_chart(chart_df)

    csv_bytes = df.to_csv(index=False).encode("utf-8")
    st.download_button(
        "Download CSV",
        data=csv_bytes,
        file_name=f"nifty500_{mode}_{(last_run or now_ist()):%Y%m%d_%H%M%S}.csv",
        mime="text/csv",
    )

# ------------------------------------------------------------- auto-refresh --
if auto_refresh and mode == "intraday":
    st.caption(f"Auto-refreshing every {interval}s while the market is open...")
    time.sleep(interval)
    st.rerun()
