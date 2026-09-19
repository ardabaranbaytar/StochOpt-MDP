import numpy as np
import pytest

from core import NegativeBinomial, Poisson, expected_cost
from core.demand import DemandDistribution

H, P_COST = 1.0, 9.0

DEMANDS = [
    pytest.param(Poisson(20), id="poisson-20"),
    pytest.param(Poisson(0.7), id="poisson-0.7"),
    pytest.param(NegativeBinomial.from_mean_var(20, 60), id="nb-20-60"),
    pytest.param(NegativeBinomial(5, 2.5), id="nb-5-r2.5"),
]


def brute_force_cost(y, demand: DemandDistribution, h, p):
    d, pr = demand.support(1e-14)
    return np.array(
        [h * (np.maximum(v - d, 0) * pr).sum() + p * (np.maximum(d - v, 0) * pr).sum() for v in y]
    )


@pytest.mark.parametrize("demand", DEMANDS)
def test_expected_cost_matches_brute_force(demand):
    y = np.arange(-5, 120)
    np.testing.assert_allclose(
        expected_cost(y, demand, H, P_COST), brute_force_cost(y, demand, H, P_COST), atol=1e-9
    )


@pytest.mark.parametrize("demand", DEMANDS)
def test_expected_cost_preserves_shape_and_scalar(demand):
    y = np.arange(12).reshape(3, 4)
    assert expected_cost(y, demand, H, P_COST).shape == (3, 4)
    assert expected_cost(7, demand, H, P_COST).shape == ()


@pytest.mark.parametrize("demand", DEMANDS)
def test_cost_is_convex_in_y(demand):
    L = expected_cost(np.arange(-5, 100), demand, H, P_COST)
    assert (np.diff(L, 2) >= -1e-9).all()


@pytest.mark.parametrize("demand", DEMANDS)
def test_support_is_a_distribution(demand):
    d, p = demand.support(1e-12)
    assert p.sum() == pytest.approx(1.0, abs=1e-11)
    assert (d * p).sum() == pytest.approx(demand.mean, rel=1e-9)


def test_negative_binomial_moments():
    nb = NegativeBinomial.from_mean_var(20, 60)
    assert nb.mean == pytest.approx(20)
    assert nb.var == pytest.approx(60)
    d, p = nb.support(1e-14)
    assert (d**2 * p).sum() - nb.mean**2 == pytest.approx(60, rel=1e-6)


def test_negative_binomial_rejects_underdispersion():
    with pytest.raises(ValueError):
        NegativeBinomial.from_mean_var(10, 10)


def test_expected_cost_rejects_non_integer_y():
    with pytest.raises(ValueError):
        expected_cost([1.5], Poisson(3), H, P_COST)
