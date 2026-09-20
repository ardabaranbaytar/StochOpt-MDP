// Mirrors api/schemas.py

export type DemandType = "poisson" | "negative_binomial";

export interface OptimizeRequest {
  demand: { type: DemandType; mu: number; var?: number };
  cost: { holding: number; shortage: number; unit_order: number; setup: number };
  bounds: {
    max_backlog: number;
    capacity: number;
    gamma: number;
    lead_time: number;
  };
}

export interface SimulateRequest extends OptimizeRequest {
  T: number;
  replications: number;
  seed: number;
}

export interface OptimizeResponse {
  s: number | null;
  S: number | null;
  is_s_S_optimal: boolean;
  iterations: number;
  residual: number;
  states: number[];
  policy: number[];
  values: number[];
}

export interface PolicyMetrics {
  mean_cost: number;
  cost_stderr: number;
  csl: number;
  fill_rate: number;
  stockout_days_ratio: number;
  mean_on_hand: number;
}

export interface Trajectory {
  days: number[];
  inventory: number[];
  position: number[];
  orders: number[];
}

export interface SimulateResponse {
  mdp: PolicyMetrics;
  basestock: PolicyMetrics;
  static_eoq: PolicyMetrics;
  theoretical_cost: number;
  simulated_discounted_cost: number;
  trajectory: Trajectory;
}

export interface DemandFitResult {
  distribution_type: DemandType;
  mu: number;
  variance: number;
  aic_scores: Record<string, number>;
  parameters: Record<string, number>;
  dispersion_index: number;
  overdispersion_p_value: number;
  n: number;
}

export interface AnalysisResult {
  request: SimulateRequest;
  optimize: OptimizeResponse;
  simulate: SimulateResponse;
}
