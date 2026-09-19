import copy

import numpy as np
import pytest
from fastapi.testclient import TestClient

import api.main as api_main
from api.main import app
from core import Poisson
from core.mdp_solver import solve_mdp

VALID = {
    "demand": {"type": "poisson", "mu": 8},
    "cost": {"holding": 1, "shortage": 5, "unit_order": 1, "setup": 30},
    "bounds": {"max_backlog": 40, "capacity": 80, "gamma": 0.95, "eps": 1e-8},
}
NB = {"type": "negative_binomial", "mu": 8, "var": 24}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:  # runs lifespan
        yield c


def payload(**changes):
    """VALID with dotted-path overrides, e.g. payload(**{"cost.holding": -1})."""
    body = copy.deepcopy(VALID)
    for path, value in changes.items():
        node = body
        *parents, leaf = path.split(".")
        for k in parents:
            node = node[k]
        if value is None:
            node.pop(leaf, None)
        else:
            node[leaf] = value
    return body


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


def test_openapi_metadata(client):
    info = client.get("/openapi.json").json()["info"]
    assert info["title"] == "StochOpt-MDP API" and info["version"] == "1.0.0"


# ---- /optimize -------------------------------------------------------------------------


def test_optimize_matches_core_solver(client):
    r = client.post("/api/v1/optimize", json=VALID)
    assert r.status_code == 200
    body = r.json()
    sol = solve_mdp(Poisson(8), 1, 5, 1, 30, 0.95, 40, 80, eps=1e-8)
    assert (body["s"], body["S"]) == (sol.s, sol.S)
    assert body["is_s_S_optimal"] is True
    assert len(body["states"]) == len(body["policy"]) == len(body["values"]) == 121
    assert body["states"][0] == -40 and body["states"][-1] == 80
    np.testing.assert_allclose(body["values"], sol.values)
    assert body["iterations"] > 0 and body["residual"] >= 0


def test_optimize_negative_binomial(client):
    r = client.post("/api/v1/optimize", json=payload(demand=NB))
    assert r.status_code == 200
    assert r.json()["S"] > r.json()["s"]


def test_optimize_defaults(client):
    body = {"demand": VALID["demand"], "cost": {"holding": 1, "shortage": 5}}
    r = client.post("/api/v1/optimize", json=body)
    assert r.status_code == 200
    assert len(r.json()["states"]) == 40 + 80 + 1  # default B, C
    assert r.json()["s"] is not None  # K=0 base-stock still reports a threshold


@pytest.mark.parametrize(
    "changes",
    [
        {"cost.holding": 0},
        {"cost.holding": -1},
        {"cost.shortage": -2},
        {"cost.setup": -1},
        {"cost.unit_order": -0.5},
        {"demand.mu": 0},
        {"demand.mu": -3},
        {"demand": {"type": "negative_binomial", "mu": 8, "var": 8}},  # var == mu
        {"demand": {"type": "negative_binomial", "mu": 8, "var": 5}},  # var < mu
        {"demand": {"type": "negative_binomial", "mu": 8}},  # var missing
        {"demand": {"type": "poisson", "mu": 8, "var": 20}},  # poisson var != mu
        {"demand.type": "gamma"},
        {"bounds.gamma": 1.0},
        {"bounds.gamma": 0},
        {"bounds.capacity": 0},
        {"bounds.max_backlog": -1},
        {"bounds.eps": 0},
        {"bounds.capacity": 10**6},
        {"cost": None},
    ],
)
def test_optimize_rejects_invalid(client, changes):
    r = client.post("/api/v1/optimize", json=payload(**changes))
    assert r.status_code == 422, r.text
    assert r.json()["detail"]  # meaningful error payload


def test_optimize_rejects_unknown_field(client):
    assert client.post("/api/v1/optimize", json={**VALID, "extra": 1}).status_code == 422


def test_validation_error_names_the_field(client):
    r = client.post("/api/v1/optimize", json=payload(**{"cost.holding": -1}))
    assert "holding" in str(r.json()["detail"])


def test_domain_value_error_maps_to_400(client, monkeypatch):
    def boom(*a, **k):
        raise ValueError("solver rejected inputs")

    monkeypatch.setattr(api_main, "solve_mdp", boom)
    r = client.post("/api/v1/optimize", json=VALID)
    assert r.status_code == 400 and r.json() == {"detail": "solver rejected inputs"}


# ---- /simulate -------------------------------------------------------------------------


@pytest.fixture(scope="module")
def sim_response(client):
    r = client.post("/api/v1/simulate", json={**VALID, "T": 365, "replications": 100, "seed": 3})
    assert r.status_code == 200, r.text
    return r.json()


def test_simulate_shape_and_ranges(sim_response):
    for key in ("mdp", "basestock", "static_eoq"):
        m = sim_response[key]
        assert set(m) == {
            "mean_cost",
            "cost_stderr",
            "csl",
            "fill_rate",
            "stockout_days_ratio",
            "mean_on_hand",
        }
        assert m["mean_cost"] > 0 and m["cost_stderr"] > 0
        for frac in ("csl", "fill_rate", "stockout_days_ratio"):
            assert 0 <= m[frac] <= 1


def test_simulate_theory_matches_simulation(sim_response):
    theo, sim = sim_response["theoretical_cost"], sim_response["simulated_discounted_cost"]
    assert sim == pytest.approx(theo, rel=0.03)


def test_simulate_mdp_is_cheapest(sim_response):
    mdp = sim_response["mdp"]["mean_cost"]
    assert mdp < sim_response["basestock"]["mean_cost"]
    assert mdp < sim_response["static_eoq"]["mean_cost"]


def test_simulate_seed_is_reproducible(client):
    body = {**VALID, "T": 60, "replications": 10, "seed": 11}
    a = client.post("/api/v1/simulate", json=body).json()
    b = client.post("/api/v1/simulate", json=body).json()
    assert a == b


def test_simulate_negative_binomial(client):
    r = client.post("/api/v1/simulate", json={**payload(demand=NB), "T": 100, "replications": 10})
    assert r.status_code == 200


@pytest.mark.parametrize(
    "extra",
    [
        {"T": 0},
        {"replications": 1},
        {"T": 100_000, "replications": 100},  # workload cap
        {"seed": -1},
    ],
)
def test_simulate_rejects_invalid_run_params(client, extra):
    assert client.post("/api/v1/simulate", json={**VALID, **extra}).status_code == 422


def test_simulate_rejects_invalid_model(client):
    bad_nb = payload(demand={"type": "negative_binomial", "mu": 8, "var": 4})
    assert client.post("/api/v1/simulate", json=bad_nb).status_code == 422
    neg_h = payload(**{"cost.holding": -1})
    assert client.post("/api/v1/simulate", json=neg_h).status_code == 422


# ---- resource limits (DoS guards) ------------------------------------------------------


@pytest.mark.parametrize(
    "changes",
    [
        {"bounds.gamma": 0.9999},  # would need ~10^5 sweeps
        {"bounds.eps": 1e-12},
        {"demand.mu": 10**6},
        {"bounds.max_backlog": 1001},
    ],
)
def test_resource_limits_rejected(client, changes):
    assert client.post("/api/v1/optimize", json=payload(**changes)).status_code == 422


@pytest.mark.filterwarnings("ignore:value iteration hit max_iter")
def test_non_convergence_is_a_400_not_a_hang(client, monkeypatch):
    monkeypatch.setattr(api_main, "MAX_VI_ITERATIONS", 2)
    r = client.post("/api/v1/optimize", json=payload(**{"bounds.eps": 1e-6}))
    assert r.status_code == 400
    assert "did not converge" in r.json()["detail"]
