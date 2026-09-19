from pathlib import Path

import numpy as np
import plotly.graph_objects as go
import pytest
from streamlit.testing.v1 import AppTest

from api.schemas import SimulateRequest
from dashboard.compute import benchmark_table, mdp_trajectory, run_analysis
from dashboard.figures import policy_figure, trajectory_figure, value_function_figure

APP = str(Path(__file__).resolve().parents[1] / "dashboard" / "app.py")

REQ = SimulateRequest.model_validate(
    {
        "demand": {"type": "poisson", "mu": 8},
        "cost": {"holding": 1, "shortage": 5, "unit_order": 1, "setup": 30},
        "bounds": {"max_backlog": 40, "capacity": 80},
        "T": 365,
        "replications": 30,
        "seed": 5,
    }
)


@pytest.fixture(scope="module")
def analysis():
    return run_analysis(REQ)


def test_analysis_and_table(analysis):
    assert analysis.solution.is_s_S_optimal
    df = benchmark_table(analysis.reports)
    assert list(df.index) == ["MDP (s, S)", "Base-Stock", "Static EOQ"]
    assert "Ortalama Maliyet ± SE" in df.columns


def test_trajectory_is_consistent(analysis):
    t = mdp_trajectory(analysis, replication=3)
    assert len(t.days) == 90
    ordered = t.orders > 0
    assert ordered.any()
    # every order lifts the position to the order-up-to level S
    assert (t.post_order[ordered] == analysis.solution.S).all()
    assert (t.inventory <= analysis.solution.S).all()
    # same path as the benchmark stream: replaying gives identical output
    np.testing.assert_array_equal(t.inventory, mdp_trajectory(analysis, 3).inventory)


def test_trajectory_shorter_than_90_days():
    a = run_analysis(REQ.model_copy(update={"T": 30, "replications": 2}))
    assert len(mdp_trajectory(a, 0).days) == 30


def test_figures(analysis):
    sol = analysis.solution
    for fig in (
        value_function_figure(sol),
        policy_figure(sol),
        trajectory_figure(mdp_trajectory(analysis, 0), sol.s, sol.S),
    ):
        assert isinstance(fig, go.Figure) and len(fig.data) >= 1


def test_app_renders_and_runs_end_to_end():
    at = AppTest.from_file(APP, default_timeout=60).run()
    assert not at.exception
    assert len(at.tabs) == 3
    assert at.button[0].label == "Optimizasyonu ve Simülasyonu Çalıştır"
    assert not at.button[0].disabled

    at.button[0].click().run()
    assert not at.exception
    metrics = {m.label: m.value for m in at.metric}
    assert metrics["s (sipariş eşiği)"] != "—"
    assert metrics["Saf (s, S) yapısı"].startswith("✅")
    assert "Teorik V*(0)" in metrics


def test_app_flags_invalid_negative_binomial():
    at = AppTest.from_file(APP, default_timeout=60).run()
    at.selectbox[0].select("negative_binomial").run()
    at.number_input[1].set_value(4.0).run()  # var below mu = 8
    assert not at.exception
    assert at.sidebar.error
    assert at.button[0].disabled
