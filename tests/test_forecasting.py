import numpy as np
import pytest
from fastapi.testclient import TestClient

from api.main import app
from core import NegativeBinomial, Poisson
from core.forecasting import DemandFitResult, fit_demand_distribution
from dashboard.compute import fit_to_model_settings, parse_sales_csv


def test_poisson_recovery():
    x = Poisson(8.0).sample(5000, np.random.default_rng(2))
    fit = fit_demand_distribution(x)
    assert isinstance(fit, DemandFitResult)
    assert fit.distribution_type == "poisson"
    assert fit.mu == pytest.approx(8.0, rel=0.03)
    assert fit.parameters["mu"] == pytest.approx(fit.mu)
    assert fit.dispersion_index == pytest.approx(1.0, abs=0.1)
    assert set(fit.aic_scores) >= {"poisson"}


def test_negative_binomial_recovery():
    truth = NegativeBinomial.from_mean_var(8.0, 24.0)  # r = 4
    x = truth.sample(5000, np.random.default_rng(2))
    fit = fit_demand_distribution(x)
    assert fit.distribution_type == "negative_binomial"
    assert fit.mu == pytest.approx(8.0, rel=0.05)
    assert fit.variance == pytest.approx(24.0, rel=0.1)
    assert fit.parameters["r"] == pytest.approx(4.0, rel=0.2)
    r, p = fit.parameters["r"], fit.parameters["p"]
    assert p == pytest.approx(r / (r + fit.mu))
    assert fit.aic_scores["negative_binomial"] < fit.aic_scores["poisson"]


def test_accepts_list_and_integral_floats():
    fit = fit_demand_distribution([3, 5, 4, 6, 2, 5.0])
    assert fit.n == 6


def test_small_overdispersed_sample_not_significant():
    # D > 1 but too little evidence -> stays Poisson
    fit = fit_demand_distribution([3, 7, 4, 6, 2, 8])
    assert fit.dispersion_index > 1
    assert fit.distribution_type == "poisson"
    assert "negative_binomial" not in fit.aic_scores


def test_underdispersed_stays_poisson():
    fit = fit_demand_distribution([5, 5, 6, 5, 4, 5, 5, 6, 4, 5])
    assert fit.dispersion_index < 1
    assert fit.distribution_type == "poisson"


def test_zero_variance_constant_series():
    fit = fit_demand_distribution([4] * 10)
    assert fit.variance == 0.0
    assert fit.distribution_type == "poisson"
    assert fit.parameters == {"mu": 4.0}


@pytest.mark.parametrize(
    "bad",
    [[], [5], [1, -2, 3], [1.5, 2, 3], [0, 0, 0], [1, np.nan, 2], ["a", "b"], [[1, 2], [3, 4]]],
)
def test_invalid_input_raises(bad):
    with pytest.raises(ValueError):
        fit_demand_distribution(bad)


def test_fit_to_model_settings():
    nb = fit_demand_distribution(
        NegativeBinomial.from_mean_var(8, 24).sample(3000, np.random.default_rng(3))
    )
    s = fit_to_model_settings(nb)
    assert s["kind"] == "negative_binomial" and s["var"] > s["mu"]
    po = fit_demand_distribution([4] * 10)
    assert fit_to_model_settings(po) == {"kind": "poisson", "mu": 4.0}


def test_parse_sales_csv():
    assert parse_sales_csv(b"day,sales\nmon,3\ntue,5\nwed,4\n") == [3, 5, 4]
    assert parse_sales_csv(b"sales\n3\n5\n4\n") == [3, 5, 4]
    assert parse_sales_csv(b"3\n5\n4\n") == [3, 5, 4]
    with pytest.raises(ValueError):
        parse_sales_csv(b"a,b\nx,y\nz,w\n")


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_api_fit_demand(client):
    sales = NegativeBinomial.from_mean_var(8, 24).sample(2000, np.random.default_rng(4)).tolist()
    r = client.post("/api/v1/fit-demand", json={"sales": sales})
    assert r.status_code == 200
    body = r.json()
    assert body["distribution_type"] == "negative_binomial"
    assert body["parameters"]["r"] == pytest.approx(4.0, rel=0.3)


@pytest.mark.parametrize("sales", [[], [3], [1, -1, 2], [1.5, 2, 3]])
def test_api_fit_demand_validation(client, sales):
    assert client.post("/api/v1/fit-demand", json={"sales": sales}).status_code == 422


def test_api_fit_demand_all_zero(client):
    assert client.post("/api/v1/fit-demand", json={"sales": [0, 0, 0]}).status_code == 400
