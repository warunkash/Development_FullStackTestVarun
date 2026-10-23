def summarize(trader, start_balance):
    """Per-trade and equity statistics. R = pnl / initial risk."""
    tr = trader.closed
    rs = [t.pnl / t.risk_ccy for t in tr if t.risk_ccy > 0]
    wins = [r for r in rs if r > 0]
    losses = [r for r in rs if r < 0]
    pnl = sum(t.pnl for t in tr)
    eq = [e for _, e in trader.equity_curve] or [start_balance]
    peak, mdd = eq[0], 0.0
    for e in eq:
        peak = max(peak, e)
        mdd = max(mdd, (peak - e) / peak)
    by = {}
    for t in tr:
        d = by.setdefault(t.symbol, dict(n=0, pnl=0.0, wins=0))
        d["n"] += 1; d["pnl"] += t.pnl; d["wins"] += t.pnl > 0
    gl = -sum(losses)
    return dict(
        trades=len(tr), wins=len(wins), win_rate=len(wins) / len(tr) if tr else 0.0,
        net_pnl=pnl, return_pct=100 * pnl / start_balance,
        avg_r=sum(rs) / len(rs) if rs else 0.0, total_r=sum(rs),
        profit_factor=(sum(wins) / gl) if gl > 0 else (float("inf") if wins else 0.0),
        max_dd_pct=100 * mdd, dd_kills=trader.dd_kills,
        rejects=dict(trader.rejects), by_symbol=by,
        exits={k: sum(1 for t in tr if t.exit_reason == k) for k in {t.exit_reason for t in tr}},
        r_list=rs,
    )
