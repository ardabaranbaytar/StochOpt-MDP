import pytest
from fastapi.testclient import TestClient

from api.main import app

BODY = {
    "demand": {"type": "poisson", "mu": 4},
    "cost": {"holding": 1, "shortage": 5, "unit_order": 1, "setup": 30},
    "bounds": {"max_backlog": 30, "capacity": 60, "gamma": 0.95, "eps": 1e-6},
    "T": 120,
    "replications": 8,
    "seed": 1,
}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def with_lead(L):
    return {**BODY, "bounds": {**BODY["bounds"], "lead_time": L}}


def optimize_body(L):
    """OptimizeRequest forbids the simulation-only fields."""
    return {k: v for k, v in with_lead(L).items() if k in ("demand", "cost", "bounds")}


def test_lead_time_raises_order_up_to_level(client):
    S = [client.post("/api/v1/optimize", json=optimize_body(L)).json()["S"] for L in (0, 1, 2)]
    assert S[0] < S[1] < S[2]


def test_lead_time_validation(client):
    assert client.post("/api/v1/optimize", json=optimize_body(-1)).status_code == 422
    assert client.post("/api/v1/optimize", json=optimize_body(1000)).status_code == 422


@pytest.mark.parametrize("L", [0, 2])
def test_simulate_returns_trajectory(client, L):
    r = client.post("/api/v1/simulate", json=with_lead(L))
    assert r.status_code == 200
    t = r.json()["trajectory"]
    n = len(t["days"])
    assert n == 90 and t["days"][0] == 1
    assert all(len(t[k]) == n for k in ("inventory", "position", "orders"))
    sol = client.post("/api/v1/optimize", json=optimize_body(L)).json()
    # after any order the inventory position is exactly S
    ordered = [p for p, q in zip(t["position"], t["orders"], strict=True) if q > 0]
    assert ordered and set(ordered) == {sol["S"]}


def test_report_endpoints(client):
    r = client.post("/api/v1/report/csv", json=BODY)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    assert b"Static EOQ" in r.content and "attachment" in r.headers["content-disposition"]
    r = client.post("/api/v1/report/pdf", json=BODY)
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    assert client.post("/api/v1/report/pdf", json={}).status_code == 422
