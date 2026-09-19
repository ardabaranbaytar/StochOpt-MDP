import numpy as np
import pytest

from core import NegativeBinomial, Poisson, expected_cost
from core.mdp_solver import solve_mdp, transition_matrix

CASES = [
    pytest.param(Poisson(8), 1.0, 5.0, 1.0, 30.0, id="poisson-K30"),
    pytest.param(NegativeBinomial.from_mean_var(8, 24), 1.0, 5.0, 1.0, 30.0, id="nb-K30"),
    pytest.param(Poisson(8), 1.0, 5.0, 1.0, 0.0, id="poisson-K0"),
]
GAMMA, B, C = 0.95, 40, 80


def test_transition_rows_sum_to_one():
    P = transition_matrix(NegativeBinomial(8, 2.0), B, C)
    np.testing.assert_allclose(P.sum(axis=1), 1.0, atol=1e-12)
    assert (P >= 0).all()


@pytest.mark.parametrize(("demand", "h", "p", "c", "K"), CASES)
def test_fixed_point_matches_naive_bellman(demand, h, p, c, K):
    sol = solve_mdp(demand, h, p, c, K, GAMMA, B, C, eps=1e-10)
    x = sol.states
    L = expected_cost(x, demand, h, p)
    W = transition_matrix(demand, B, C) @ sol.values
    # naive O(|S|^2) Bellman operator
    TV = np.array(
        [
            min(
                (K if y > xi else 0.0) + c * (y - xi) + L[j] + GAMMA * W[j]
                for j, y in enumerate(x)
                if y >= xi
            )
            for xi in x
        ]
    )
    np.testing.assert_allclose(TV, sol.values, atol=1e-6)


@pytest.mark.parametrize(("demand", "h", "p", "c", "K"), CASES)
def test_policy_is_s_S(demand, h, p, c, K):
    sol = solve_mdp(demand, h, p, c, K, GAMMA, B, C)
    assert sol.is_s_S_optimal
    assert sol.s is not None and sol.S is not None
    assert sol.S >= sol.s
    assert (sol.policy[sol.states > sol.s] == 0).all()
    assert (sol.policy[sol.states <= sol.s] > 0).all()
    if K > 0:
        assert sol.S > sol.s
    else:
        assert sol.S == sol.s + 1  # base-stock: order whenever below S


def test_higher_fixed_cost_widens_band():
    lo = solve_mdp(Poisson(8), 1, 5, 1, 5.0, GAMMA, B, C)
    hi = solve_mdp(Poisson(8), 1, 5, 1, 60.0, GAMMA, B, C)
    assert hi.S - hi.s > lo.S - lo.s


def test_rejects_bad_gamma():
    with pytest.raises(ValueError):
        solve_mdp(Poisson(8), 1, 5, 1, 0, 1.0, B, C)


def test_reports_non_convergence():
    with pytest.warns(UserWarning, match="max_iter"):
        sol = solve_mdp(Poisson(8), 1, 5, 1, 30, GAMMA, B, C, max_iter=3)
    assert not sol.converged and sol.iterations == 3


def test_converged_flag_set_on_success():
    assert solve_mdp(Poisson(8), 1, 5, 1, 30, GAMMA, B, C).converged
