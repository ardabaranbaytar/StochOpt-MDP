import numpy as np
import pytest

from core import NegativeBinomial, Poisson, expected_cost
from core.mdp_solver import solve_mdp
from simulation import BenchmarkEngine, MDPPolicy

H, P, C, K, GAMMA = 1.0, 5.0, 1.0, 30.0, 0.95
B, CAP = 40, 80
DEMANDS = [
    pytest.param(Poisson(4), id="poisson"),
    pytest.param(NegativeBinomial.from_mean_var(4, 12), id="nb"),
]


def solve(demand, L, **kw):
    args = dict(holding=H, shortage=P, order_cost=C, fixed_cost=K, gamma=GAMMA, B=B, C=CAP)
    return solve_mdp(demand, **{**args, **kw}, lead_time=L)


# ---------------------------------------------------------------- convolution / cost


def test_convolve_closed_forms():
    assert Poisson(3).convolve(4).mu == pytest.approx(12)
    nb = NegativeBinomial.from_mean_var(4, 12).convolve(3)
    assert nb.mean == pytest.approx(12)
    assert nb.var == pytest.approx(3 * 12)  # independent sum: variances add
    with pytest.raises(ValueError):
        Poisson(3).convolve(0)


def test_convolve_matches_numerical_convolution():
    base = NegativeBinomial.from_mean_var(3, 7)
    d, p = base.support(1e-14)
    pmf3 = np.convolve(np.convolve(p, p), p)
    got = base.convolve(3).pmf(np.arange(len(pmf3)))
    assert np.allclose(got[:40], pmf3[:40], atol=1e-9)


@pytest.mark.parametrize("demand", DEMANDS)
def test_expected_cost_lead_time(demand):
    y = np.arange(-10, 60)
    assert np.array_equal(
        expected_cost(y, demand, H, P), expected_cost(y, demand, H, P, lead_time=0)
    )
    for L in (1, 2):
        got = expected_cost(y, demand, H, P, lead_time=L)
        assert np.allclose(got, expected_cost(y, demand.convolve(L + 1), H, P))
    with pytest.raises(ValueError):
        expected_cost(y, demand, H, P, lead_time=-1)


@pytest.mark.parametrize("demand", DEMANDS)
def test_min_expected_cost_grows_with_lead_time(demand):
    y = np.arange(0, 80)
    mins = [expected_cost(y, demand, H, P, lead_time=L).min() for L in (0, 1, 2)]
    assert mins[0] < mins[1] < mins[2]


# ---------------------------------------------------------------- backward compatibility


@pytest.mark.parametrize("demand", DEMANDS)
def test_lead_time_zero_is_identical_to_legacy(demand):
    """L=0 must reproduce the original formulation: cost L(y) and no extra discount."""
    default = solve_mdp(demand, H, P, C, K, GAMMA, B, CAP)
    explicit = solve(demand, 0)
    assert explicit.lead_time == 0
    assert np.array_equal(default.values, explicit.values)
    assert np.array_equal(default.policy, explicit.policy)
    assert (default.s, default.S) == (explicit.s, explicit.S)

    # independent re-implementation of the pre-lead-time Bellman operator
    from core.mdp_solver import transition_matrix

    x = np.arange(-B, CAP + 1)
    Lx, Pm = expected_cost(x, demand, H, P), transition_matrix(demand, B, CAP)
    V = explicit.values
    H_ = C * x + Lx + GAMMA * (Pm @ V)
    sufmin = np.minimum.accumulate(H_[::-1])[::-1]
    Tv = -C * x + np.minimum(H_, np.append(K + sufmin[1:], np.inf))
    assert np.abs(Tv - V).max() < 1e-4


def test_invalid_lead_time():
    for bad in (-1, 1.5):
        with pytest.raises(ValueError):
            solve(Poisson(4), bad)


# ---------------------------------------------------------------- L = 1, 2 validity


@pytest.mark.parametrize("demand", DEMANDS)
@pytest.mark.parametrize("L", [1, 2])
def test_policy_validity(demand, L):
    sol = solve(demand, L)
    assert sol.converged and sol.lead_time == L
    assert np.all(np.isfinite(sol.values))
    assert np.all(sol.policy >= 0)
    assert np.all(sol.states + sol.policy <= CAP)
    assert sol.is_s_S_optimal
    assert sol.s is not None and sol.S is not None and sol.s < sol.S
    # (s, S) structure on the inventory position: order iff x <= s, always up to S
    ordering = sol.policy > 0
    assert np.array_equal(ordering, sol.states <= sol.s)
    assert np.all((sol.states + sol.policy)[ordering] == sol.S)


@pytest.mark.parametrize("demand", DEMANDS)
def test_monotone_in_lead_time(demand):
    """Longer lead time => more demand uncertainty to cover => higher order-up-to level and
    reorder point on the inventory position."""
    sols = [solve(demand, L) for L in (0, 1, 2)]
    S = [s.S for s in sols]
    s_ = [s.s for s in sols]
    assert S[0] < S[1] < S[2]
    assert s_[0] < s_[1] < s_[2]
    # with mean demand 4, S should exceed the demand over the lead-time window
    assert S[2] > 3 * demand.mean


@pytest.mark.parametrize("L", [0, 1, 2])
def test_value_nonincreasing_below_reorder_point(L):
    sol = solve(Poisson(4), L)
    v = sol.values[sol.states <= sol.s]
    assert np.all(np.diff(v) <= 1e-9)


# ---------------------------------------------------------------- simulation compatibility


@pytest.mark.parametrize("L", [1, 2])
def test_policy_is_applied_to_inventory_position_in_simulation(L):
    """The environment feeds on-hand + on-order to the policy; with the lead-time-aware MDP
    policy the position right after each order is S, and it beats the L=0 policy."""
    demand = Poisson(4)
    sol_L, sol_0 = solve(demand, L), solve(demand, 0)
    engine = BenchmarkEngine(
        demand, H, P, C, K, gamma=GAMMA, horizon=1500, n_reps=20, seed=3, lead_time=L
    )

    class Spy(MDPPolicy):
        positions_after: list[int] = []

        def order_quantity(self, position):
            q = super().order_quantity(position)
            if q:
                Spy.positions_after.append(position + q)
            return q

    Spy.name = "MDP"
    engine.run([Spy(sol_L)])
    assert Spy.positions_after and set(Spy.positions_after) == {sol_L.S}

    reports = engine.run([MDPPolicy(sol_L), _renamed(MDPPolicy(sol_0), "MDP0")])
    diff, se = engine.paired_difference(reports["MDP"], reports["MDP0"])
    assert diff < 0 and abs(diff) > 3 * se


def _renamed(policy, name):
    policy.name = name
    return policy
