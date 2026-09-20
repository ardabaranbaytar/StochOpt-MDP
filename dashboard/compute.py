"""Streamlit-free analysis helpers (kept separate so they are unit-testable)."""

from __future__ import annotations

import io
from dataclasses import dataclass

import numpy as np
import pandas as pd

from api.schemas import SimulateRequest
from core import NegativeBinomial, Poisson
from core.demand import DemandDistribution
from core.forecasting import DemandFitResult, fit_demand_distribution
from core.mdp_solver import MDPSolution, solve_mdp
from simulation import (
    BaseStockPolicy,
    BenchmarkEngine,
    InventoryEnvironment,
    MDPPolicy,
    PolicyReport,
    StaticEOQPolicy,
)

SOLVER_EPS = 1e-6
POLICY_LABELS = {"MDP": "MDP (s, S)", "BaseStock": "Base-Stock", "StaticEOQ": "Static EOQ"}


@dataclass(frozen=True)
class Analysis:
    request: SimulateRequest
    demand: DemandDistribution
    solution: MDPSolution
    engine: BenchmarkEngine
    reports: dict[str, PolicyReport]
    comparison: dict[str, float]


@dataclass(frozen=True)
class Trajectory:
    days: np.ndarray
    inventory: np.ndarray  # end-of-day net inventory
    post_order: np.ndarray  # inventory position right after ordering
    orders: np.ndarray


def build_demand(req: SimulateRequest) -> DemandDistribution:
    if req.demand.type == "poisson":
        return Poisson(req.demand.mu)
    return NegativeBinomial.from_mean_var(req.demand.mu, req.demand.var)


def run_analysis(req: SimulateRequest) -> Analysis:
    """Solve the MDP and benchmark it against the heuristics (x0 = 0)."""
    demand = build_demand(req)
    h, p, c, K = req.cost.holding, req.cost.shortage, req.cost.unit_order, req.cost.setup
    b = req.bounds
    sol = solve_mdp(demand, h, p, c, K, b.gamma, b.max_backlog, b.capacity, eps=SOLVER_EPS)
    engine = BenchmarkEngine(
        demand,
        h,
        p,
        c,
        K,
        gamma=b.gamma,
        horizon=req.T,
        n_reps=req.replications,
        seed=req.seed,
    )
    reports = engine.run(
        [
            MDPPolicy(sol),
            BaseStockPolicy.from_newsvendor(demand, h, p),
            StaticEOQPolicy.from_eoq(demand, h, K),
        ]
    )
    return Analysis(req, demand, sol, engine, reports, engine.compare_with_mdp(sol, reports["MDP"]))


def benchmark_table(reports: dict[str, PolicyReport]) -> pd.DataFrame:
    def pm(r: PolicyReport, m: str, nd: int = 3) -> str:
        return f"{r.mean(m):.{nd}f} ± {r.stderr(m):.{nd}f}"

    rows = {
        POLICY_LABELS.get(name, name): {
            "Ortalama Maliyet ± SE": pm(r, "mean_cost"),
            "CSL": f"{r.mean('cycle_service_level'):.3f}",
            "Dolum Oranı": f"{r.mean('fill_rate'):.3f}",
            "Stoksuz Gün Oranı": f"{r.mean('stockout_rate'):.3f}",
            "Ortalama Stok": f"{r.mean('mean_on_hand'):.2f}",
        }
        for name, r in reports.items()
    }
    return pd.DataFrame.from_dict(rows, orient="index")


def mdp_trajectory(a: Analysis, replication: int, days: int = 90) -> Trajectory:
    """MDP-policy path of one replication, on the same demand stream the benchmark used."""
    req = a.request
    ss = np.random.SeedSequence(req.seed).spawn(req.replications)[replication]
    env = InventoryEnvironment(
        a.demand,
        req.cost.holding,
        req.cost.shortage,
        req.cost.unit_order,
        req.cost.setup,
        initial_inventory=0,
    )
    res = env.run(MDPPolicy(a.solution), req.T, np.random.default_rng(ss))
    n = min(days, req.T)
    inv, orders = res.inventory_levels[:n], res.orders[:n]
    start = np.concatenate([[0], inv[:-1]])  # start-of-day stock (lead time 0)
    return Trajectory(np.arange(1, n + 1), inv, start + orders, orders)


def parse_sales_csv(data: bytes) -> list[int]:
    """Daily sales from the first numeric column of a CSV (a header row is optional)."""
    try:
        df = pd.read_csv(io.BytesIO(data), header=None, skip_blank_lines=True)
    except (pd.errors.ParserError, pd.errors.EmptyDataError, UnicodeDecodeError) as e:
        raise ValueError(f"CSV okunamadı: {e}") from e
    for col in df.columns:
        values = pd.to_numeric(df[col], errors="coerce")
        # first row may be a header; any other non-numeric cell makes the column unusable
        if values.iloc[1:].notna().all() and values.notna().sum() >= 2:
            return [int(v) if float(v).is_integer() else v for v in values.dropna()]
    raise ValueError("CSV içinde sayısal bir satış sütunu bulunamadı")


def fit_from_csv(data: bytes) -> DemandFitResult:
    return fit_demand_distribution(parse_sales_csv(data))


def fit_to_model_settings(fit: DemandFitResult) -> dict[str, object]:
    """Sidebar widget values (``kind`` / ``mu`` / ``var``) implied by a fit result."""
    settings: dict[str, object] = {"kind": fit.distribution_type, "mu": round(fit.mu, 2)}
    if fit.distribution_type == "negative_binomial":
        settings["var"] = round(fit.variance, 2)
    return settings
