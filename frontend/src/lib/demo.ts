import { DEFAULT_FORM, type FormValues, toSimulateRequest } from "./form";
import type { AnalysisResult, OptimizeResponse, PolicyMetrics, SimulateResponse } from "./types";

/**
 * Client-side value-iteration + Monte Carlo used to populate the dashboard on first paint
 * (ported from the StochOptDashboard.jsx design prototype). It mirrors the API's result shapes, so
 * the same components render both this sample and live `POST /optimize` / `POST /simulate` results.
 */

const DAYS = 90;
const REPS = 100;
const MAX_SWEEPS = 400;
const TOL = 1e-6;

/** Truncated Poisson pmf (renormalised). */
function poissonPmf(mu: number): number[] {
  const dMax = Math.ceil(mu + 6 * Math.sqrt(mu)) + 5;
  const pm: number[] = [];
  let f = Math.exp(-mu);
  for (let d = 0; d <= dMax; d++) {
    pm.push(f);
    f = (f * mu) / (d + 1);
  }
  const total = pm.reduce((a, b) => a + b, 0);
  return pm.map((v) => v / total);
}

/** Small deterministic LCG so the sample is stable across reloads. */
function lcg(seed: number) {
  let z = seed >>> 0;
  return () => (z = (Math.imul(z, 1664525) + 1013904223) >>> 0) / 4294967296;
}

interface Sim {
  metrics: PolicyMetrics;
  path: number[];
  positions: number[];
  orders: number[];
  discounted: number;
}

function buildDemo(f: FormValues): AnalysisResult {
  const t0 = performance.now();
  const { maxBacklog: B, capacity: C, setup: K, unitOrder: c, holding: h, shortage: p, gamma } = f;
  const pm = poissonPmf(f.mu);
  const N = B + C + 1;
  const idx = (x: number) => x + B;
  const clampX = (y: number) => Math.min(C, Math.max(-B, y));

  // stage costs and transitions
  const stage = (x: number, q: number) => {
    let e = 0;
    for (let d = 0; d < pm.length; d++) {
      const y = x + q - d;
      e += pm[d] * (y >= 0 ? h * y : -p * y);
    }
    return (q > 0 ? K : 0) + c * q + e;
  };
  const SC: number[][] = [];
  const TR: number[][][] = [];
  for (let xi = 0; xi < N; xi++) {
    const x = xi - B;
    const sc: number[] = [];
    const tr: number[][] = [];
    for (let q = 0; q <= C - x; q++) {
      sc.push(stage(x, q));
      tr.push(pm.map((_, d) => idx(clampX(x + q - d))));
    }
    SC.push(sc);
    TR.push(tr);
  }

  // value iteration
  let V = new Float64Array(N);
  const pol = new Int32Array(N);
  let residual = 0;
  let sweeps = 0;
  const residualHistory: number[] = [];
  for (let it = 0; it < MAX_SWEEPS; it++) {
    const next = new Float64Array(N);
    for (let xi = 0; xi < N; xi++) {
      let best = Infinity;
      let bq = 0;
      for (let q = 0; q < SC[xi].length; q++) {
        let ev = 0;
        const t = TR[xi][q];
        for (let d = 0; d < pm.length; d++) ev += pm[d] * V[t[d]];
        const val = SC[xi][q] + gamma * ev;
        if (val < best - 1e-9) {
          best = val;
          bq = q;
        }
      }
      next[xi] = best;
      pol[xi] = bq;
    }
    residual = 0;
    for (let i = 0; i < N; i++) residual = Math.max(residual, Math.abs(next[i] - V[i]));
    V = next;
    sweeps = it + 1;
    residualHistory.push(residual);
    if (residual < TOL) break;
  }

  // (s, S) read-off: the highest ordering state gives s and S = s + q
  let s: number | null = null;
  let S: number | null = null;
  for (let xi = N - 1; xi >= 0; xi--) {
    if (pol[xi] > 0) {
      s = xi - B;
      S = s + pol[xi];
      break;
    }
  }
  const isSS = s !== null && S !== null && Array.from(pol).every((q, xi) => (xi - B <= s! ? q === S! - (xi - B) : q === 0));

  // Monte Carlo on common random numbers
  const cdf: number[] = [];
  let acc = 0;
  pm.forEach((w) => cdf.push((acc += w)));
  const drawDemand = (u: () => number) => {
    const r = u();
    let d = 0;
    while (d < cdf.length - 1 && r > cdf[d]) d++;
    return d;
  };
  const start = Math.round((S ?? C) * 0.6);

  const simulate = (order: (x: number) => number, demand: number[]): Sim => {
    let x = start;
    let cost = 0;
    let discounted = 0;
    let unmet = 0;
    let total = 0;
    let onHand = 0;
    let okDays = 0;
    let soDays = 0;
    const path: number[] = [];
    const positions: number[] = [];
    const orders: number[] = [];
    demand.forEach((d, t) => {
      const q = Math.max(0, Math.min(C - x, order(x)));
      let stageCost = c * q + (q > 0 ? K : 0);
      const y = x + q;
      const served = Math.min(Math.max(y, 0), d);
      total += d;
      if (served >= d) okDays++;
      else {
        soDays++;
        unmet += d - served;
      }
      x = clampX(y - d);
      stageCost += x >= 0 ? h * x : -p * x;
      cost += stageCost;
      discounted += Math.pow(gamma, t) * stageCost;
      onHand += Math.max(x, 0);
      path.push(x);
      positions.push(y);
      orders.push(q);
    });
    const n = demand.length;
    return {
      metrics: {
        mean_cost: cost / n,
        cost_stderr: 0,
        csl: okDays / n,
        fill_rate: total > 0 ? 1 - unmet / total : 1,
        stockout_days_ratio: soDays / n,
        mean_on_hand: onHand / n,
      },
      path,
      positions,
      orders,
      discounted,
    };
  };

  const meanDemand = pm.reduce((a, w, d) => a + w * d, 0);
  const eoqQ = Math.max(1, Math.round(Math.sqrt((2 * K * meanDemand) / Math.max(h, 0.01))));
  const rop = Math.round(meanDemand * f.leadTime);
  const policies = {
    mdp: (x: number) => pol[idx(clampX(x))],
    basestock: (x: number) => (S !== null && x < S ? S - x : 0),
    static_eoq: (x: number) => (x <= rop ? eoqQ : 0),
  };

  const u = lcg(20260920);
  const streams = Array.from({ length: REPS }, () => Array.from({ length: DAYS }, () => drawDemand(u)));
  const summarize = (key: keyof typeof policies) => {
    const runs = streams.map((dem) => simulate(policies[key], dem));
    const costs = runs.map((r) => r.metrics.mean_cost);
    const mean = costs.reduce((a, b) => a + b, 0) / REPS;
    const sd = Math.sqrt(costs.reduce((a, b) => a + (b - mean) ** 2, 0) / (REPS - 1));
    const avg = (pick: (m: PolicyMetrics) => number) => runs.reduce((a, r) => a + pick(r.metrics), 0) / REPS;
    const metrics: PolicyMetrics = {
      mean_cost: mean,
      cost_stderr: sd / Math.sqrt(REPS),
      csl: avg((m) => m.csl),
      fill_rate: avg((m) => m.fill_rate),
      stockout_days_ratio: avg((m) => m.stockout_days_ratio),
      mean_on_hand: avg((m) => m.mean_on_hand),
    };
    return { metrics, first: runs[0], discounted: runs.reduce((a, r) => a + r.discounted, 0) / REPS };
  };
  const mdp = summarize("mdp");
  const basestock = summarize("basestock");
  const staticEoq = summarize("static_eoq");

  const states = Array.from({ length: N }, (_, i) => i - B);
  const optimize: OptimizeResponse = {
    s,
    S,
    is_s_S_optimal: isSS,
    iterations: sweeps,
    residual,
    states,
    policy: Array.from(pol),
    values: Array.from(V),
  };
  const sim: SimulateResponse = {
    mdp: mdp.metrics,
    basestock: basestock.metrics,
    static_eoq: staticEoq.metrics,
    theoretical_cost: V[idx(0)],
    simulated_discounted_cost: mdp.discounted,
    trajectory: {
      days: Array.from({ length: DAYS }, (_, i) => i + 1),
      inventory: mdp.first.path,
      position: mdp.first.positions,
      orders: mdp.first.orders,
    },
  };

  return {
    request: { ...toSimulateRequest(f), T: DAYS, replications: REPS },
    optimize,
    simulate: sim,
    residualHistory,
    solveMs: Math.max(1, Math.round(performance.now() - t0)),
  };
}

let cached: AnalysisResult | undefined;

/** Sample analysis for the default parameters; solved once per page load. */
export function getDemoResult(): AnalysisResult {
  cached ??= buildDemo(DEFAULT_FORM);
  return cached;
}
