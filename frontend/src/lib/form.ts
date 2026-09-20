import type { DemandType, OptimizeRequest, SimulateRequest } from "./types";

export interface FormValues {
  demandType: DemandType;
  mu: number;
  variance: number;
  setup: number; // K
  unitOrder: number; // c
  holding: number; // h
  shortage: number; // p
  gamma: number;
  maxBacklog: number; // B
  capacity: number; // C
  leadTime: number; // L
  horizon: number; // T
  replications: number;
  seed: number;
}

export const DEFAULT_FORM: FormValues = {
  demandType: "poisson",
  mu: 8,
  variance: 24,
  setup: 30,
  unitOrder: 1,
  holding: 1,
  shortage: 5,
  gamma: 0.95,
  maxBacklog: 40,
  capacity: 80,
  leadTime: 0,
  horizon: 365,
  replications: 200,
  seed: 42,
};

const MAX_SIM_STEPS = 1_000_000;

/** Client-side mirror of the API validation, so users see errors before a round trip. */
export function validateForm(f: FormValues): string[] {
  const errors: string[] = [];
  const isInt = Number.isInteger;
  if (!(f.mu > 0 && f.mu <= 10_000)) errors.push("μ must be in (0, 10 000].");
  if (f.demandType === "negative_binomial" && !(f.variance > f.mu))
    errors.push("σ² must be greater than μ for Negative Binomial demand.");
  if (!(f.holding > 0)) errors.push("h must be > 0.");
  if (!(f.shortage > 0)) errors.push("p must be > 0.");
  if (!(f.setup >= 0)) errors.push("K must be ≥ 0.");
  if (!(f.unitOrder >= 0)) errors.push("c must be ≥ 0.");
  if (!(f.gamma > 0 && f.gamma <= 0.995)) errors.push("γ must be in (0, 0.995].");
  if (!(isInt(f.maxBacklog) && f.maxBacklog >= 0 && f.maxBacklog <= 1000))
    errors.push("B must be an integer in [0, 1000].");
  if (!(isInt(f.capacity) && f.capacity >= 1 && f.capacity <= 1000))
    errors.push("C must be an integer in [1, 1000].");
  if (!(isInt(f.leadTime) && f.leadTime >= 0 && f.leadTime <= 30))
    errors.push("L must be an integer in [0, 30].");
  if (!(isInt(f.horizon) && f.horizon >= 1)) errors.push("T must be a positive integer.");
  if (!(isInt(f.replications) && f.replications >= 2))
    errors.push("Replications must be an integer ≥ 2.");
  if (f.horizon * f.replications > MAX_SIM_STEPS)
    errors.push(`T × replications must be ≤ ${MAX_SIM_STEPS.toLocaleString("en-US")}.`);
  if (!(isInt(f.seed) && f.seed >= 0)) errors.push("Seed must be an integer ≥ 0.");
  return errors;
}

export function toOptimizeRequest(f: FormValues): OptimizeRequest {
  return {
    demand:
      f.demandType === "poisson"
        ? { type: "poisson", mu: f.mu }
        : { type: "negative_binomial", mu: f.mu, var: f.variance },
    cost: { holding: f.holding, shortage: f.shortage, unit_order: f.unitOrder, setup: f.setup },
    bounds: {
      max_backlog: f.maxBacklog,
      capacity: f.capacity,
      gamma: f.gamma,
      lead_time: f.leadTime,
    },
  };
}

export function toSimulateRequest(f: FormValues): SimulateRequest {
  return { ...toOptimizeRequest(f), T: f.horizon, replications: f.replications, seed: f.seed };
}
