import time

import pytest

from agent_os import Budget, BudgetExceeded


def test_step_ceiling():
    b = Budget(max_steps=2)
    b.check(); b.charge()
    b.check(); b.charge()
    with pytest.raises(BudgetExceeded, match="step ceiling"):
        b.check()


def test_cost_ceiling_is_checked_before_the_spend():
    # The point: refuse the call we cannot afford, rather than noticing after.
    b = Budget(max_steps=100, max_cost=1.0)
    b.charge(cost=0.9)
    with pytest.raises(BudgetExceeded, match="cost ceiling"):
        b.check(next_cost=0.2)
    b.check(next_cost=0.1)


def test_time_ceiling():
    b = Budget(max_steps=100, max_seconds=0.05)
    b.start()
    b.check()
    time.sleep(0.06)
    with pytest.raises(BudgetExceeded, match="time ceiling"):
        b.check()


def test_remaining_steps_never_negative():
    b = Budget(max_steps=1)
    b.charge(steps=5)
    assert b.remaining_steps() == 0


def test_start_resets_the_clock():
    b = Budget(max_steps=5, max_seconds=0.05)
    time.sleep(0.06)
    b.start()
    b.check()  # would raise if the clock had not been reset


def test_zero_steps_rejected():
    with pytest.raises(ValueError, match="at least 1"):
        Budget(max_steps=0)


def test_snapshot_reports_both_sides():
    b = Budget(max_steps=10, max_cost=5.0)
    b.charge(steps=3, cost=1.5)
    snap = b.snapshot()
    assert snap["steps_used"] == 3 and snap["max_steps"] == 10
    assert snap["cost_used"] == 1.5 and snap["max_cost"] == 5.0


def test_budget_resets_between_runs_by_default():
    # A spec reused for a second run must not arrive pre-charged.
    b = Budget(max_steps=5, max_cost=1.0)
    b.start(); b.charge(steps=3, cost=0.5)
    b.start()
    assert b.steps_used == 0 and b.cost_used == 0.0


def test_carry_over_keeps_a_lifetime_ceiling():
    b = Budget(max_steps=5, carry_over=True)
    b.start(); b.charge(steps=3)
    b.start()
    assert b.steps_used == 3
