"""Pydantic v2 request/response models for the StochOpt-MDP API."""

from __future__ import annotations

from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

MAX_STATES = 1_000  # per side of the state space (B and C)
MAX_SIM_STEPS = 1_000_000  # T * replications


class DemandConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["poisson", "negative_binomial"] = Field(description="Demand family.")
    mu: float = Field(gt=0, le=10_000, description="Mean demand per period.")
    var: float | None = Field(
        default=None,
        gt=0,
        description="Demand variance. Required (> mu) for negative_binomial; "
        "for poisson it must be omitted or equal to mu.",
    )

    @model_validator(mode="after")
    def _check_variance(self) -> Self:
        if self.type == "negative_binomial":
            if self.var is None:
                raise ValueError("var is required for negative_binomial")
            if self.var <= self.mu:
                raise ValueError("negative_binomial requires var > mu")
        elif self.var is not None and self.var != self.mu:
            raise ValueError("poisson has var == mu; omit var or set it equal to mu")
        return self


class CostConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    holding: float = Field(gt=0, description="Holding cost h per unit per period.")
    shortage: float = Field(gt=0, description="Backorder cost p per unit per period.")
    unit_order: float = Field(default=0.0, ge=0, description="Unit ordering cost c.")
    setup: float = Field(default=0.0, ge=0, description="Fixed ordering cost K.")


class SystemBounds(BaseModel):
    model_config = ConfigDict(extra="forbid")

    max_backlog: int = Field(default=40, ge=0, le=MAX_STATES, description="B: lowest state is -B.")
    capacity: int = Field(default=80, ge=1, le=MAX_STATES, description="C: highest state / S cap.")
    gamma: float = Field(default=0.95, gt=0, le=0.995, description="Discount factor.")
    eps: float = Field(default=1e-4, ge=1e-8, le=1, description="Value-iteration tolerance.")


class OptimizeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    demand: DemandConfig
    cost: CostConfig
    bounds: SystemBounds = Field(default_factory=SystemBounds)


class OptimizeResponse(BaseModel):
    s: int | None = Field(description="Reorder point: highest state with a positive order.")
    S: int | None = Field(description="Order-up-to level reached from s.")
    is_s_S_optimal: bool
    iterations: int
    residual: float
    states: list[int]
    policy: list[int] = Field(description="Optimal order quantity for each state.")
    values: list[float] = Field(description="Optimal discounted cost V*(x) for each state.")


class SimulateRequest(OptimizeRequest):
    T: int = Field(default=365, ge=1, le=100_000, description="Days per replication.")
    replications: int = Field(default=100, ge=2, le=100_000, description="Independent runs.")
    seed: int | None = Field(default=None, ge=0, description="Seed for reproducible demand paths.")

    @model_validator(mode="after")
    def _check_workload(self) -> Self:
        if self.T * self.replications > MAX_SIM_STEPS:
            raise ValueError(f"T * replications must be <= {MAX_SIM_STEPS}")
        return self


class PolicyMetrics(BaseModel):
    mean_cost: float = Field(description="Mean per-period cost across replications.")
    cost_stderr: float = Field(description="Standard error of mean_cost.")
    csl: float = Field(description="Cycle service level: share of periods with no shortage.")
    fill_rate: float
    stockout_days_ratio: float = Field(description="Share of days ending with stock <= 0.")
    mean_on_hand: float


class SimulateResponse(BaseModel):
    mdp: PolicyMetrics
    basestock: PolicyMetrics
    static_eoq: PolicyMetrics
    theoretical_cost: float = Field(description="V*(0): optimal expected discounted cost, x0=0.")
    simulated_discounted_cost: float = Field(
        description="Simulated mean discounted cost of the MDP policy from x0=0 (compare to V*(0))."
    )
