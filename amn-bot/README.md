# AMN Trading Bot

Execution and alert engine for the AMN model (trend BOS, shallow-tap inducement, sweep into the origin zone, 1m confirmation). See the PRD for the rules.

- `amn/engine.py`: per-symbol state machine (IDLE, BOS_CONFIRMED, SHALLOW_TAP_FORMED, SWEEP_DETECTED, LTF_CONFIRMATION_PENDING, IN_TRADE)
- `amn/execution.py`: sizing, spread/news/session/max-position filters, bracket management, 3% daily kill
- `amn/store.py`, `amn/alerts.py`: SQLite recovery, Telegram/webhook alerts
- `amn/backtest.py`: multi-symbol event-driven backtest on 1m bars
- `tests/test_amn.py`: TC-01 to TC-05 plus supporting checks (`python -m pytest tests`)

```
python amn/fetch_data.py   # last ~4 weeks of 1m data from Yahoo (futures proxies for XAU/SPX/NAS)
python run_all.py          # real-data run + synthetic no-edge Monte Carlo -> reports/results.json
python build_report.py      # reports/index.html
```

No live broker adapter is included. Implement the three methods of `execution.Broker` for MT5, cTrader or Tradovate.
