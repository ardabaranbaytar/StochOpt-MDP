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

export const MAX_SIM_STEPS = 1_000_000;

/** One code per rule a form can break; the UI turns each into a sentence (see i18n `formErrors`). */
export type FormError =
  | "mu"
  | "variance"
  | "holding"
  | "shortage"
  | "setup"
  | "unitOrder"
  | "gamma"
  | "maxBacklog"
  | "capacity"
  | "leadTime"
  | "horizon"
  | "replications"
  | "workload"
  | "seed";

/** Client-side mirror of the API validation, so users see errors before a round trip. */
export function validateForm(f: FormValues): FormError[] {
  const errors: FormError[] = [];
  const isInt = Number.isInteger;
  if (!(f.mu > 0 && f.mu <= 10_000)) errors.push("mu");
  if (f.demandType === "negative_binomial" && !(f.variance > f.mu)) errors.push("variance");
  if (!(f.holding > 0)) errors.push("holding");
  if (!(f.shortage > 0)) errors.push("shortage");
  if (!(f.setup >= 0)) errors.push("setup");
  if (!(f.unitOrder >= 0)) errors.push("unitOrder");
  if (!(f.gamma > 0 && f.gamma <= 0.995)) errors.push("gamma");
  if (!(isInt(f.maxBacklog) && f.maxBacklog >= 0 && f.maxBacklog <= 1000)) errors.push("maxBacklog");
  if (!(isInt(f.capacity) && f.capacity >= 1 && f.capacity <= 1000)) errors.push("capacity");
  if (!(isInt(f.leadTime) && f.leadTime >= 0 && f.leadTime <= 30)) errors.push("leadTime");
  if (!(isInt(f.horizon) && f.horizon >= 1)) errors.push("horizon");
  if (!(isInt(f.replications) && f.replications >= 2)) errors.push("replications");
  if (f.horizon * f.replications > MAX_SIM_STEPS) errors.push("workload");
  if (!(isInt(f.seed) && f.seed >= 0)) errors.push("seed");
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
