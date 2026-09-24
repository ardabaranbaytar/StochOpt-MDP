"""FastAPI service exposing the MDP solver and the Monte Carlo benchmark."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from functools import partial

import anyio
import anyio.to_thread
import numpy as np
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response

from core import NegativeBinomial, Poisson
from core.demand import DemandDistribution
from core.forecasting import fit_demand_distribution
from core.mdp_solver import MDPSolution, solve_mdp
from dashboard.compute import run_analysis
from dashboard.export import benchmark_csv, policy_report_pdf
from simulation import (
    BaseStockPolicy,
    BenchmarkEngine,
    InventoryEnvironment,
    MDPPolicy,
    PolicyReport,
    StaticEOQPolicy,
)

from .schemas import (
    TRAJECTORY_DAYS,
    DemandConfig,
    FitDemandRequest,
    FitDemandResponse,
    OptimizeRequest,
    OptimizeResponse,
    PolicyMetrics,
    SimulateRequest,
    SimulateResponse,
    Trajectory,
)

# Small public servers set STOCHOPT_MAX_JOBS=1 so one visitor cannot starve the others.
MAX_CONCURRENT_JOBS = int(os.getenv("STOCHOPT_MAX_JOBS", "4"))
MAX_VI_ITERATIONS = 10_000  # hard cap on value-iteration sweeps per request


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # bounds the number of CPU-heavy jobs running in worker threads at once
    app.state.limiter = anyio.CapacityLimiter(MAX_CONCURRENT_JOBS)
    yield


app = FastAPI(
    title="StochOpt-MDP API",
    version="1.0.0",
    description="Optimal (s, S) inventory policies via MDP value iteration, "
    "benchmarked by discrete-event simulation.",
    lifespan=lifespan,
)


@app.exception_handler(ValueError)
async def value_error_handler(_: Request, exc: ValueError) -> JSONResponse:
    """Domain errors raised by core/simulation that slipped past schema validation."""
    return JSONResponse(status_code=400, content={"detail": str(exc)})


def _build_demand(cfg: DemandConfig) -> DemandDistribution:
    if cfg.type == "poisson":
        return Poisson(cfg.mu)
    return NegativeBinomial.from_mean_var(cfg.mu, cfg.var)


def _solve(req: OptimizeRequest) -> tuple[DemandDistribution, MDPSolution]:
    demand = _build_demand(req.demand)
    sol = solve_mdp(
        demand,
        holding=req.cost.holding,
        shortage=req.cost.shortage,
        order_cost=req.cost.unit_order,
        fixed_cost=req.cost.setup,
        gamma=req.bounds.gamma,
        B=req.bounds.max_backlog,
        C=req.bounds.capacity,
        eps=req.bounds.eps,
        max_iter=MAX_VI_ITERATIONS,
        lead_time=req.bounds.lead_time,
    )
    if not sol.converged:
        raise ValueError(
            f"value iteration did not converge within {MAX_VI_ITERATIONS} iterations; "
            "increase eps or decrease gamma"
        )
    return demand, sol


def _metrics(r: PolicyReport) -> PolicyMetrics:
    return PolicyMetrics(
        mean_cost=r.mean("mean_cost"),
        cost_stderr=r.stderr("mean_cost"),
        csl=r.mean("cycle_service_level"),
        fill_rate=r.mean("fill_rate"),
        stockout_days_ratio=r.mean("stockout_rate"),
        mean_on_hand=r.mean("mean_on_hand"),
    )


def _optimize(req: OptimizeRequest) -> OptimizeResponse:
    _, sol = _solve(req)
    return OptimizeResponse(
        s=sol.s,
        S=sol.S,
        is_s_S_optimal=sol.is_s_S_optimal,
        iterations=sol.iterations,
        residual=sol.residual,
        states=sol.states.tolist(),
        policy=sol.policy.tolist(),
        values=sol.values.tolist(),
    )


def _trajectory(demand: DemandDistribution, req: SimulateRequest, sol: MDPSolution) -> Trajectory:
    """MDP-policy path of replication 0, drawn from the same seed stream as the benchmark."""
    env = InventoryEnvironment(
        demand,
        req.cost.holding,
        req.cost.shortage,
        req.cost.unit_order,
        req.cost.setup,
        lead_time=req.bounds.lead_time,
        initial_inventory=0,
    )
    ss = np.random.SeedSequence(req.seed).spawn(req.replications)[0]
    res = env.run(MDPPolicy(sol), req.T, np.random.default_rng(ss))
    n = min(TRAJECTORY_DAYS, req.T)
    # position after ordering = everything ordered so far - demand of the previous days
    position = np.cumsum(res.orders) - np.concatenate([[0], np.cumsum(res.demands)[:-1]])
    return Trajectory(
        days=list(range(1, n + 1)),
        inventory=res.inventory_levels[:n].tolist(),
        position=position[:n].tolist(),
        orders=res.orders[:n].tolist(),
    )


def _simulate(req: SimulateRequest) -> SimulateResponse:
    demand, sol = _solve(req)
    h, p, c, K = req.cost.holding, req.cost.shortage, req.cost.unit_order, req.cost.setup
    engine = BenchmarkEngine(
        demand,
        h,
        p,
        c,
        K,
        gamma=req.bounds.gamma,
        horizon=req.T,
        n_reps=req.replications,
        seed=req.seed,
        lead_time=req.bounds.lead_time,
        initial_inventory=0,
    )
    reports = engine.run(
        [
            MDPPolicy(sol),
            BaseStockPolicy.from_newsvendor(demand, h, p),
            StaticEOQPolicy.from_eoq(demand, h, K, lead_time=req.bounds.lead_time),
        ]
    )
    cmp = engine.compare_with_mdp(sol, reports["MDP"])
    return SimulateResponse(
        mdp=_metrics(reports["MDP"]),
        basestock=_metrics(reports["BaseStock"]),
        static_eoq=_metrics(reports["StaticEOQ"]),
        theoretical_cost=cmp["V_x0"],
        simulated_discounted_cost=cmp["sim_discounted"],
        trajectory=_trajectory(demand, req, sol),
    )


async def _run_blocking(request: Request, fn, *args):
    """Run CPU-bound work in a worker thread so the event loop stays responsive."""
    limiter = getattr(request.app.state, "limiter", None)
    return await anyio.to_thread.run_sync(partial(fn, *args), limiter=limiter)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/optimize", response_model=OptimizeResponse, tags=["mdp"])
async def optimize(req: OptimizeRequest, request: Request) -> OptimizeResponse:
    """Solve the MDP by value iteration and return the optimal (s, S) policy."""
    return await _run_blocking(request, _optimize, req)


@app.post("/api/v1/simulate", response_model=SimulateResponse, tags=["mdp"])
async def simulate(req: SimulateRequest, request: Request) -> SimulateResponse:
    """Optimize, then benchmark MDP vs base-stock vs static EOQ by Monte Carlo simulation."""
    return await _run_blocking(request, _simulate, req)


@app.post("/api/v1/fit-demand", response_model=FitDemandResponse, tags=["forecasting"])
async def fit_demand(req: FitDemandRequest) -> FitDemandResponse:
    """Fit Poisson / Negative Binomial to a daily sales history and pick the best by AIC."""
    return fit_demand_distribution(req.sales)


@app.post("/api/v1/report/csv", tags=["reports"])
async def report_csv(req: SimulateRequest, request: Request) -> Response:
    """Benchmark table + input parameters as a downloadable CSV."""
    a = await _run_blocking(request, run_analysis, req)
    return Response(
        benchmark_csv(a),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="benchmark.csv"'},
    )


@app.post("/api/v1/report/pdf", tags=["reports"])
async def report_pdf(req: SimulateRequest, request: Request) -> Response:
    """One-page Executive Inventory Policy Summary as a downloadable PDF."""
    a = await _run_blocking(request, run_analysis, req)
    return Response(
        policy_report_pdf(a),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="inventory_policy_summary.pdf"'},
    )
