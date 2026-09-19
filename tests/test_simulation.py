import math

import numpy as np
import pytest

from core import Poisson
from core.mdp_solver import solve_mdp
from simulation import (
    BaseStockPolicy,
    BenchmarkEngine,
    InventoryEnvironment,
    MDPPolicy,
    SimulationResult,
    StaticEOQPolicy,
)

DEMAND = Poisson(8)
H, P, C, K, GAMMA = 1.0, 5.0, 1.0, 30.0, 0.95


def env(**kw):
    args = dict(demand=DEMAND, holding=H, shortage=P, order_cost=C, fixed_cost=K)
    return InventoryEnvironment(**{**args, **kw})


# ---- environment: deterministic traces -------------------------------------------------


def test_base_stock_trace_lead_time_zero():
    res = env(fixed_cost=0.0).run(BaseStockPolicy(5), 3, demands=[3, 4, 7])
    np.testing.assert_array_equal(res.orders, [5, 3, 4])
    np.testing.assert_array_equal(res.inventory_levels, [2, 1, -2])
    # day costs: c*q + h*max(x,0) + p*max(-x,0)
    np.testing.assert_allclose(res.daily_costs, [5 + 2, 3 + 1, 4 + 5 * 2])
    np.testing.assert_array_equal(res.unmet, [0, 0, 2])


def test_fixed_cost_charged_only_when_ordering():
    res = env().run(StaticEOQPolicy(0, 10), 2, demands=[3, 3])
    # day0: pos 0 <= 0 -> order 10; day1: pos 7 > 0 -> no order
    np.testing.assert_array_equal(res.orders, [10, 0])
    np.testing.assert_allclose(res.daily_costs, [K + 10 + 7, 4])


def test_lead_time_pipeline_and_position():
    seen = []

    class Spy:
        name = "spy"

        def order_quantity(self, position):
            seen.append(position)
            return 4 if len(seen) == 1 else 0

    res = env(lead_time=2, fixed_cost=0.0).run(Spy(), 4, demands=[1, 1, 1, 1])
    # order of 4 placed day 0 arrives day 2; position counts it while on order
    assert seen == [0, 3, 2, 1]
    np.testing.assert_array_equal(res.inventory_levels, [-1, -2, 1, 0])


def test_backorders_are_served_after_arrival():
    class OnceThen0:
        name = "once"

        def __init__(self):
            self.n = 0

        def order_quantity(self, position):
            self.n += 1
            return 5 if self.n == 1 else 0

    res = env(lead_time=1, fixed_cost=0.0).run(OnceThen0(), 3, demands=[2, 2, 2])
    # day0: x=-2, day1: +5 arrives -> 3, D=2 -> 1, day2 -> -1
    np.testing.assert_array_equal(res.inventory_levels, [-2, 1, -1])
    np.testing.assert_array_equal(res.unmet, [2, 0, 1])


def test_initial_inventory_and_bad_inputs():
    res = env(initial_inventory=10).run(StaticEOQPolicy(-100, 1), 1, demands=[4])
    assert res.inventory_levels[0] == 6
    with pytest.raises(ValueError):
        env().run(BaseStockPolicy(1), 3, demands=[1, 2])
    with pytest.raises(ValueError):
        env(lead_time=-1)


def test_same_rng_seed_reproduces_path():
    a = env().run(BaseStockPolicy(10), 50, rng=np.random.default_rng(1))
    b = env().run(BaseStockPolicy(10), 50, rng=np.random.default_rng(1))
    np.testing.assert_array_equal(a.demands, b.demands)
    np.testing.assert_array_equal(a.daily_costs, b.daily_costs)


# ---- metrics ---------------------------------------------------------------------------


def make_result():
    return SimulationResult(
        inventory_levels=np.array([3, 0, -2, 5]),
        orders=np.array([0, 0, 0, 0]),
        demands=np.array([2, 3, 4, 1]),
        daily_costs=np.array([1.0, 2.0, 3.0, 4.0]),
        unmet=np.array([0, 0, 2, 0]),
    )


def test_metrics():
    r = make_result()
    assert r.total_cost == 10 and r.mean_cost == 2.5
    assert r.cycle_service_level == 0.75
    assert r.fill_rate == pytest.approx(1 - 2 / 10)
    assert r.stockout_rate == 0.5  # end levels 0 and -2
    assert r.mean_on_hand == pytest.approx(2.0)  # (3+0+0+5)/4
    assert r.mean_net_inventory == pytest.approx(1.5)
    assert r.discounted_cost(0.5) == pytest.approx(1 + 1 + 0.75 + 0.5)


def test_fill_rate_no_demand():
    z = np.zeros(3, dtype=int)
    r = SimulationResult(z, z, z, np.zeros(3), z)
    assert r.fill_rate == 1.0


# ---- policies --------------------------------------------------------------------------


def test_policies():
    assert BaseStockPolicy(10).order_quantity(4) == 6
    assert BaseStockPolicy(10).order_quantity(12) == 0
    eoq = StaticEOQPolicy(5, 10)
    assert eoq.order_quantity(6) == 0
    assert eoq.order_quantity(5) == 10
    assert eoq.order_quantity(-5) == 20  # 2 multiples needed to exceed s
    assert (-5 + 20) > 5


def test_eoq_formula_and_newsvendor():
    eoq = StaticEOQPolicy.from_eoq(DEMAND, H, K, lead_time=2, safety_stock=3)
    assert eoq.Q == round(math.sqrt(2 * K * 8 / H))
    assert eoq.order_point == 16 + 3
    bs = BaseStockPolicy.from_newsvendor(DEMAND, H, P)
    assert DEMAND.cdf(bs.S) >= P / (P + H) > DEMAND.cdf(bs.S - 1)


def test_mdp_policy_matches_solution_and_clamps():
    sol = solve_mdp(DEMAND, H, P, C, K, GAMMA, 20, 60)
    pol = MDPPolicy(sol)
    for x in (-20, -5, sol.s, sol.s + 1, 60):
        assert pol.order_quantity(int(x)) == sol.policy[x + 20]
    assert pol.order_quantity(-30) == sol.S - (-30)  # below -B: still ordered up to S
    assert pol.order_quantity(500) == 0


# ---- Monte Carlo benchmark -------------------------------------------------------------


@pytest.fixture(scope="module")
def bench():
    sol = solve_mdp(DEMAND, H, P, C, K, GAMMA, 40, 80)
    engine = BenchmarkEngine(DEMAND, H, P, C, K, GAMMA, horizon=365, n_reps=150, seed=7)
    policies = [
        MDPPolicy(sol),
        BaseStockPolicy.from_newsvendor(DEMAND, H, P),
        StaticEOQPolicy.from_eoq(DEMAND, H, K),
    ]
    return sol, engine, engine.run(policies)


def test_common_random_numbers(bench):
    _, engine, reports = bench
    again = engine.run([BaseStockPolicy(12)])
    again2 = engine.run([BaseStockPolicy(12)])
    np.testing.assert_array_equal(
        again["BaseStock"].raw["mean_cost"], again2["BaseStock"].raw["mean_cost"]
    )


def test_simulated_discounted_cost_matches_v_star(bench):
    sol, engine, reports = bench
    cmp = engine.compare_with_mdp(sol, reports["MDP"])
    assert abs(cmp["discounted_gap_in_se"]) < 4
    assert cmp["sim_avg_cost"] > 0


def test_mdp_beats_heuristics(bench):
    _, engine, reports = bench
    for other in ("BaseStock", "StaticEOQ"):
        diff, se = engine.paired_difference(reports["MDP"], reports[other])
        assert diff < -3 * se


def test_metric_ranges_and_table(bench):
    _, engine, reports = bench
    for r in reports.values():
        assert 0 <= r.mean("fill_rate") <= 1
        assert 0 <= r.mean("cycle_service_level") <= 1
        assert r.stderr("mean_cost") > 0
    table = engine.format_table(reports)
    assert "MDP" in table and "StaticEOQ" in table


def test_compare_rejects_out_of_range_x0():
    sol = solve_mdp(DEMAND, H, P, C, K, GAMMA, 5, 20)
    engine = BenchmarkEngine(DEMAND, H, P, C, K, GAMMA, n_reps=2, initial_inventory=99)
    with pytest.raises(ValueError):
        engine.compare_with_mdp(sol, None)
