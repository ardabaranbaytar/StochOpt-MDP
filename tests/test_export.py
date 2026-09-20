import csv
import io
import re

import pytest

from api.schemas import SimulateRequest
from dashboard.compute import run_analysis
from dashboard.export import benchmark_csv, input_parameters, pdf_available, policy_report_pdf

REQ = SimulateRequest.model_validate(
    {
        "demand": {"type": "negative_binomial", "mu": 8, "var": 24},
        "cost": {"holding": 1, "shortage": 5, "unit_order": 1, "setup": 30},
        "bounds": {"max_backlog": 40, "capacity": 80},
        "T": 200,
        "replications": 10,
        "seed": 5,
    }
)


@pytest.fixture(scope="module")
def analysis():
    return run_analysis(REQ)


def test_csv_contents(analysis):
    raw = benchmark_csv(analysis)
    assert raw.startswith(b"\xef\xbb\xbf")
    rows = list(csv.reader(io.StringIO(raw.decode("utf-8-sig"))))
    flat = {r[0]: r[1:] for r in rows if r}
    assert flat["Demand distribution"] == ["Negative Binomial"]
    assert flat["Demand variance"] == ["24"]
    assert flat["s"] == [str(analysis.solution.s)]
    header = next(r for r in rows if r and r[0] == "Policy")
    assert "Cycle service level (CSL)" in header and "Fill rate" in header
    body = [r for r in rows if r and r[0] in ("MDP (s, S)", "Base-Stock", "Static EOQ")]
    assert len(body) == 3
    mdp = next(r for r in body if r[0].startswith("MDP"))
    assert float(mdp[1]) == pytest.approx(analysis.reports["MDP"].mean("mean_cost"), abs=1e-6)


def test_input_parameters_poisson_has_no_variance():
    req = SimulateRequest.model_validate(
        {**REQ.model_dump(), "demand": {"type": "poisson", "mu": 8}}
    )
    assert "Demand variance" not in dict(input_parameters(run_analysis(req)))


@pytest.mark.skipif(not pdf_available(), reason="reportlab not installed")
def test_pdf_is_single_page(analysis):
    pdf = policy_report_pdf(analysis)
    assert pdf.startswith(b"%PDF")
    assert len(re.findall(rb"/Type\s*/Page\b", pdf)) == 1
