"""End-to-end check that a Kronos install can actually forecast.

Loads Kronos-small with the base tokenizer, forecasts 30 bars from the 400-bar
lookback in the upstream sample data, and sanity-checks the output frame.

Usage: python verify_install.py [kronos-dir]   (default: ./Kronos)
"""
import sys
from pathlib import Path

import pandas as pd

LOOKBACK = 400
PRED_LEN = 30
FEATURES = ["open", "high", "low", "close", "volume", "amount"]


def main() -> int:
    kronos_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "Kronos").resolve()
    sys.path.insert(0, str(kronos_dir))
    from model import Kronos, KronosPredictor, KronosTokenizer

    print("Loading Kronos-small + Tokenizer-base ...")
    tokenizer = KronosTokenizer.from_pretrained("NeoQuasar/Kronos-Tokenizer-base")
    model = Kronos.from_pretrained("NeoQuasar/Kronos-small")
    predictor = KronosPredictor(model, tokenizer, device="cpu", max_context=512)

    df = pd.read_csv(kronos_dir / "tests" / "data" / "regression_input.csv")
    df["timestamps"] = pd.to_datetime(df["timestamps"])

    print(f"Forecasting {PRED_LEN} bars from a {LOOKBACK}-bar context ...")
    pred = predictor.predict(
        df=df.loc[: LOOKBACK - 1, FEATURES],
        x_timestamp=df.loc[: LOOKBACK - 1, "timestamps"],
        y_timestamp=df.loc[LOOKBACK : LOOKBACK + PRED_LEN - 1, "timestamps"],
        pred_len=PRED_LEN,
        T=1.0,
        top_p=0.9,
        sample_count=1,
        verbose=False,
    )

    assert pred.shape == (PRED_LEN, len(FEATURES)), f"unexpected shape {pred.shape}"
    assert list(pred.columns) == FEATURES, f"unexpected columns {list(pred.columns)}"
    assert pred.notna().all().all(), "forecast contains NaNs"
    # A degenerate model can emit a flat line that still passes the checks above.
    assert pred["close"].nunique() > 1, "forecast close prices are constant"

    print(pred.head().to_string())
    print("\nOK: Kronos install verified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
