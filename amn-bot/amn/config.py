"""Strategy, risk and instrument configuration (PRD sections 3-4)."""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class InstrumentSpec:
    name: str
    pip: float                # 1 "pip" in price units
    value_per_unit: float     # account-ccy P&L per 1.0 price-unit move per 1 lot
    typical_spread: float     # price units, used by the simulated broker
    max_spread: float         # PRD spread filter (<=1.5 pips / 20 points)
    max_slippage: float       # PRD slippage guard (1.0 pip)
    lot_step: float = 0.01
    min_lot: float = 0.01
    max_lot: float = 50.0


INSTRUMENTS = {
    "EURUSD": InstrumentSpec("EURUSD", 0.0001, 100_000, 0.00006, 0.00015, 0.0001),
    "GBPUSD": InstrumentSpec("GBPUSD", 0.0001, 100_000, 0.00009, 0.00015, 0.0001),
    "XAUUSD": InstrumentSpec("XAUUSD", 0.10, 100, 0.15, 0.20, 0.10),
    "SPX500": InstrumentSpec("SPX500", 1.0, 1, 0.40, 1.00, 1.00),
    "NAS100": InstrumentSpec("NAS100", 1.0, 1, 1.00, 2.00, 2.00),
}


@dataclass
class Config:
    # --- structure / zones ---
    htf_minutes: int = 15
    swing_n: int = 3                  # fractal width (State 1)
    atr_n: int = 14
    require_continuation: bool = True  # only trade BOS in the direction of the prior BOS
    # --- inducement (State 3) ---
    tap_atr_mult: float = 0.5         # X ATR distance buffer between tap low and zone
    min_bounce_bars: int = 2          # consecutive pro-trend candles
    max_setup_age_htf: int = 96       # HTF bars before a setup expires (24h on 15m)
    # --- LTF confirmation (State 5) ---
    ltf_swing_n: int = 2
    ltf_timeout: int = 120            # 1m bars to wait for confirmation after the sweep
    body_mult: float = 1.5
    avg_body_n: int = 10
    wick_frac: float = 0.40
    sl_atr_buffer: float = 0.5
    min_rr: float = 2.0               # minimum RR to TP2 or the signal is rejected
    tp1_fraction: float = 0.5
    # --- risk (section 4) ---
    balance: float = 10_000.0
    risk_pct: float = 1.0
    daily_dd_pct: float = 3.0
    max_positions: int = 2
    news_window_min: int = 15
    sessions: tuple = ((7, 11), (12, 16))   # UTC entry windows (London / New York)
    max_slippage_pips: float = 1.0
