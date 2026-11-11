# Kronos

Reproducible install of [Kronos](https://github.com/shiyu-coder/Kronos) (MIT),
an open-source foundation model for financial candlesticks (K-lines), trained
on data from 45+ global exchanges. It pairs a specialised tokenizer with an
autoregressive Transformer to forecast OHLCV bars.

Upstream is cloned rather than vendored, pinned to commit `67b630e`.

## Install

```bash
cd kronos
./install.sh              # installs into ./Kronos
./install.sh /opt/kronos  # or a directory of your choosing
```

Needs Python 3.10+ and network access to GitHub, PyPI and Hugging Face. The
script creates a virtualenv, installs the dependencies, and then verifies the
result (see below). Budget ~1.3 GB of disk: ~1.2 GB venv, ~110 MB of model
weights cached under `~/.cache/huggingface`.

PyTorch is installed from the CPU wheel index by default, since the stock PyPI
wheel bundles ~2.5 GB of CUDA libraries that are unused without a GPU. On a GPU
machine, use the standard wheels instead:

```bash
KRONOS_CPU_ONLY=0 ./install.sh
```

## Verifying

`install.sh` runs both checks automatically; run them by hand any time:

```bash
cd Kronos && .venv/bin/python -m pytest tests/test_kronos_regression.py -q
```

That is the upstream regression suite. It pins its own checkpoint revisions and
asserts exact forecast MSE values, so a pass confirms the dependencies *and*
the downloaded weights are correct.

```bash
Kronos/.venv/bin/python verify_install.py Kronos
```

`verify_install.py` is an end-to-end smoke test: it loads Kronos-small,
forecasts 30 bars from a 400-bar context, and checks the output frame's shape,
columns, and that the forecast is neither NaN nor a flat line.

## Available checkpoints

Pulled from the Hugging Face Hub on first use.

| Model | Params | Context | Tokenizer |
| --- | --- | --- | --- |
| `NeoQuasar/Kronos-mini` | 4.1M | 2048 | `NeoQuasar/Kronos-Tokenizer-2k` |
| `NeoQuasar/Kronos-small` | 24.7M | 512 | `NeoQuasar/Kronos-Tokenizer-base` |
| `NeoQuasar/Kronos-base` | 102.3M | 512 | `NeoQuasar/Kronos-Tokenizer-base` |

Kronos-large (499.2M) is announced upstream but not open-sourced.

## Usage

```python
import sys
sys.path.insert(0, "kronos/Kronos")   # or install the venv on your PYTHONPATH

import pandas as pd
from model import Kronos, KronosTokenizer, KronosPredictor

tokenizer = KronosTokenizer.from_pretrained("NeoQuasar/Kronos-Tokenizer-base")
model = Kronos.from_pretrained("NeoQuasar/Kronos-small")
predictor = KronosPredictor(model, tokenizer, device="cpu", max_context=512)

# df needs columns: open, high, low, close, volume, amount
pred_df = predictor.predict(
    df=x_df,                  # historical bars (up to max_context rows)
    x_timestamp=x_timestamp,  # their timestamps
    y_timestamp=y_timestamp,  # timestamps to forecast for
    pred_len=120,
    T=1.0, top_p=0.9, sample_count=1,
)
```

`predict` returns a DataFrame of `open, high, low, close, volume, amount`
indexed by `y_timestamp`. Sampling is stochastic — set a seed, or raise
`sample_count` to average over several paths, if you need stable output.

Upstream also ships `examples/` (including a plotting walkthrough), `finetune/`
(qlib-based, needs `pip install pyqlib`), `finetune_csv/` (fine-tune from a
plain CSV), and `webui/` (Flask UI, has its own `requirements.txt`).

## Notes

- CPU inference is fine for the sizes above; the regression suite runs in ~30s.
- `examples/prediction_example.py` reads `./data/XSHG_5min_600977.csv`, which
  upstream does not ship. `tests/data/regression_input.csv` and
  `finetune_csv/data/*.csv` are checked in and work as drop-in substitutes.
- Forecasts here are for research only, not trading advice.
