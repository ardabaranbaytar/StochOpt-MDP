"""Baseline policies and a common-random-numbers Monte Carlo benchmark engine."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from core.demand import DemandDistribution
from core.mdp_solver import MDPSolution

from .environment import InventoryEnvironment, Policy

METRICS = (
    "total_cost",
    "mean_cost",
    "discounted_cost",
    "cycle_service_level",
    "fill_rate",
    "stockout_rate",
    "mean_on_hand",
)


class MDPPolicy:
    """Table lookup of the MDP optimum; positions outside [-B, C] are clamped.

    The table is indexed by the inventory position (net + on-order), which is exactly what
    ``InventoryEnvironment`` passes to ``order_quantity`` for any lead time.
    """

    name = "MDP"

    def __init__(self, solution: MDPSolution):
        self.solution = solution
        self._lo = int(solution.states[0])
        self._hi = int(solution.states[-1])

    def order_quantity(self, position: int) -> int:
        if position > self._hi:
            return 0
        xc = max(position, self._lo)
        q = int(self.solution.policy[xc - self._lo])
        return 0 if q == 0 else xc + q - position  # keep the order-up-to level


class BaseStockPolicy:
    """Order up to S every period (classical K = 0 rule)."""

    name = "BaseStock"

    def __init__(self, S: int):
        self.S = int(S)

    @classmethod
    def from_newsvendor(cls, demand: DemandDistribution, holding: float, shortage: float):
        """S = smallest y with F(y) >= p / (p + h) for one-period demand."""
        ratio = shortage / (shortage + holding)
        return cls(int(demand._frozen().ppf(ratio)))

    def order_quantity(self, position: int) -> int:
        return max(self.S - position, 0)


class StaticEOQPolicy:
    """(s, Q): when position <= s, order the fewest multiples of Q that lift it above s."""

    name = "StaticEOQ"

    def __init__(self, order_point: int, order_quantity: int):
        if order_quantity < 1:
            raise ValueError("order_quantity must be >= 1")
        self.order_point = int(order_point)
        self.Q = int(order_quantity)

    @classmethod
    def from_eoq(
        cls,
        demand: DemandDistribution,
        holding: float,
        fixed_cost: float,
        lead_time: int = 0,
        safety_stock: int = 0,
    ):
        """Q = sqrt(2 K mu / h); s = mu * lead_time + safety_stock (deterministic EOQ)."""
        Q = max(1, round(math.sqrt(2 * fixed_cost * demand.mean / holding)))
        return cls(math.ceil(demand.mean * lead_time) + safety_stock, Q)

    def order_quantity(self, position: int) -> int:
        if position > self.order_point:
            return 0
        return self.Q * math.ceil((self.order_point - position + 1) / self.Q)


@dataclass(frozen=True)
class PolicyReport:
    """Per-replication metric arrays (shape ``(n_reps,)``) for one policy."""

    name: str
    raw: dict[str, np.ndarray]

    def mean(self, metric: str) -> float:
        return float(self.raw[metric].mean())

    def stderr(self, metric: str) -> float:
        v = self.raw[metric]
        return float(v.std(ddof=1) / math.sqrt(len(v))) if len(v) > 1 else float("nan")


class BenchmarkEngine:
    def __init__(
        self,
        demand: DemandDistribution,
        holding: float,
        shortage: float,
        order_cost: float,
        fixed_cost: float,
        gamma: float,
        horizon: int = 365,
        n_reps: int = 200,
        seed: int = 0,
        lead_time: int = 0,
        initial_inventory: int = 0,
    ):
        self.gamma = gamma
        self.horizon = horizon
        self.n_reps = n_reps
        self.seed = seed
        self.initial_inventory = initial_inventory
        self.env = InventoryEnvironment(
            demand, holding, shortage, order_cost, fixed_cost, lead_time, initial_inventory
        )

    def run(self, policies: list[Policy]) -> dict[str, PolicyReport]:
        """Run every policy on the same ``n_reps`` demand paths (common random numbers)."""
        seeds = np.random.SeedSequence(self.seed).spawn(self.n_reps)
        reports = {}
        for pol in policies:
            raw = {m: np.empty(self.n_reps) for m in METRICS}
            for i, ss in enumerate(seeds):
                res = self.env.run(pol, self.horizon, np.random.default_rng(ss))
                raw["total_cost"][i] = res.total_cost
                raw["mean_cost"][i] = res.mean_cost
                raw["discounted_cost"][i] = res.discounted_cost(self.gamma)
                raw["cycle_service_level"][i] = res.cycle_service_level
                raw["fill_rate"][i] = res.fill_rate
                raw["stockout_rate"][i] = res.stockout_rate
                raw["mean_on_hand"][i] = res.mean_on_hand
            reports[pol.name] = PolicyReport(pol.name, raw)
        return reports

    @staticmethod
    def paired_difference(a: PolicyReport, b: PolicyReport, metric: str = "mean_cost"):
        """(mean, stderr) of a - b over replications; valid because paths are shared."""
        diff = a.raw[metric] - b.raw[metric]
        return float(diff.mean()), float(diff.std(ddof=1) / math.sqrt(len(diff)))

    def compare_with_mdp(self, solution: MDPSolution, report: PolicyReport) -> dict[str, float]:
        """Theory vs simulation for the MDP policy.

        * discounted: simulated E[sum gamma^t cost_t] vs V*(x0) -- the exact identity for
          lead_time == 0.  For lead_time > 0 V* excludes the sunk costs of the first L days, so
          the two only agree approximately.
        * average: simulated mean per-period cost vs (1 - gamma) V*(x0) -- the requested
          per-period proxy; it is only approximate because the simulation is undiscounted.
        """
        x0 = self.initial_inventory
        if not solution.states[0] <= x0 <= solution.states[-1]:
            raise ValueError("initial_inventory outside the MDP state space")
        v0 = float(solution.values[x0 - solution.states[0]])
        d_mean, d_se = report.mean("discounted_cost"), report.stderr("discounted_cost")
        a_mean, a_se = report.mean("mean_cost"), report.stderr("mean_cost")
        theory_avg = (1 - self.gamma) * v0
        return {
            "V_x0": v0,
            "sim_discounted": d_mean,
            "sim_discounted_se": d_se,
            "discounted_gap_in_se": (d_mean - v0) / d_se if d_se > 0 else float("nan"),
            "theory_avg_cost": theory_avg,
            "sim_avg_cost": a_mean,
            "sim_avg_cost_se": a_se,
            "avg_rel_gap": (a_mean - theory_avg) / theory_avg if theory_avg else float("nan"),
        }

    @staticmethod
    def format_table(reports: dict[str, PolicyReport]) -> str:
        cols = ["mean_cost", "cycle_service_level", "fill_rate", "stockout_rate", "mean_on_hand"]
        lines = ["policy".ljust(12) + "".join(c.rjust(24) for c in cols)]
        for name, r in reports.items():
            cells = (f"{r.mean(c):.4f} ± {r.stderr(c):.4f}" for c in cols)
            lines.append(name.ljust(12) + "".join(s.rjust(24) for s in cells))
        return "\n".join(lines)
