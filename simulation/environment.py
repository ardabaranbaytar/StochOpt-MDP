"""SimPy discrete-event inventory environment (1 period = 1 day).

Daily cycle, mirroring the MDP timing so realised cost is comparable to V*:

1. receive orders whose lead time has elapsed;
2. the policy sees the inventory position (net on-hand + on-order) and orders;
   ``K*1[q>0] + c*q`` is charged immediately (lead time 0: stock arrives at once);
3. demand is realised, net inventory drops (negative = backorder);
4. end-of-day holding ``h*max(x,0)`` / shortage ``p*max(-x,0)`` is charged.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Protocol

import numpy as np
import simpy

from core.demand import DemandDistribution


class Policy(Protocol):
    name: str

    def order_quantity(self, position: int) -> int:
        """Units to order given the inventory position (on-hand + on-order - backorders)."""


@dataclass(frozen=True)
class SimulationResult:
    """Time series of one replication (index = day) and the metrics derived from them."""

    inventory_levels: np.ndarray  # end-of-day net inventory
    orders: np.ndarray
    demands: np.ndarray
    daily_costs: np.ndarray  # ordering + holding + shortage
    unmet: np.ndarray  # demand not served from on-hand stock that day

    @property
    def horizon(self) -> int:
        return len(self.demands)

    @property
    def total_cost(self) -> float:
        return float(self.daily_costs.sum())

    @property
    def mean_cost(self) -> float:
        return float(self.daily_costs.mean())

    @property
    def cycle_service_level(self) -> float:
        """Share of periods whose demand was met with zero shortage."""
        return float((self.unmet == 0).mean())

    @property
    def fill_rate(self) -> float:
        """Served demand / total demand (1.0 if there was no demand)."""
        total = self.demands.sum()
        return 1.0 if total == 0 else float(1.0 - self.unmet.sum() / total)

    @property
    def stockout_rate(self) -> float:
        """Share of days ending with no stock on hand (net inventory <= 0)."""
        return float((self.inventory_levels <= 0).mean())

    @property
    def mean_on_hand(self) -> float:
        return float(np.maximum(self.inventory_levels, 0).mean())

    @property
    def mean_net_inventory(self) -> float:
        return float(self.inventory_levels.mean())

    def discounted_cost(self, gamma: float) -> float:
        """sum_t gamma^t * cost_t (same convention as the MDP value function)."""
        return float(self.daily_costs @ gamma ** np.arange(self.horizon))


class InventoryEnvironment:
    def __init__(
        self,
        demand: DemandDistribution,
        holding: float,
        shortage: float,
        order_cost: float = 0.0,
        fixed_cost: float = 0.0,
        lead_time: int = 0,
        initial_inventory: int = 0,
    ):
        if lead_time < 0:
            raise ValueError("lead_time must be >= 0")
        self.demand = demand
        self.h, self.p, self.c, self.K = holding, shortage, order_cost, fixed_cost
        self.lead_time = int(lead_time)
        self.initial_inventory = int(initial_inventory)

    def run(
        self,
        policy: Policy,
        horizon: int,
        rng: np.random.Generator | None = None,
        demands: np.ndarray | None = None,
    ) -> SimulationResult:
        """Simulate ``horizon`` days.  Pass ``demands`` to replay a fixed demand path."""
        if demands is None:
            demands = self.demand.sample(horizon, rng)
        demands = np.asarray(demands, dtype=np.int64)
        if len(demands) != horizon:
            raise ValueError("demands must have length == horizon")

        inv = np.zeros(horizon, dtype=np.int64)
        orders = np.zeros(horizon, dtype=np.int64)
        unmet = np.zeros(horizon, dtype=np.int64)
        costs = np.zeros(horizon)

        state = {"x": self.initial_inventory, "on_order": 0}
        pipeline: deque[tuple[int, int]] = deque()  # (arrival day, qty), FIFO
        env = simpy.Environment()

        def day_loop():
            for t in range(horizon):
                # 1. receive
                while pipeline and pipeline[0][0] <= t:
                    q = pipeline.popleft()[1]
                    state["x"] += q
                    state["on_order"] -= q
                # 2. decide + order
                q = int(policy.order_quantity(state["x"] + state["on_order"]))
                if q < 0:
                    raise ValueError(f"{policy.name} returned negative order {q}")
                cost = 0.0
                if q > 0:
                    cost += self.K + self.c * q
                    orders[t] = q
                    if self.lead_time == 0:
                        state["x"] += q
                    else:
                        pipeline.append((t + self.lead_time, q))
                        state["on_order"] += q
                # 3. demand
                d = int(demands[t])
                unmet[t] = d - min(d, max(state["x"], 0))
                state["x"] -= d
                # 4. end-of-day cost
                x = state["x"]
                inv[t] = x
                costs[t] = cost + self.h * max(x, 0) + self.p * max(-x, 0)
                yield env.timeout(1)

        env.process(day_loop())
        env.run()
        return SimulationResult(inv, orders, demands, costs, unmet)
