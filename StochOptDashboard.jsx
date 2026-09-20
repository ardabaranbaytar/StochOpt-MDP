// StochOpt Enterprise — single-file React dashboard (paste-ready for Claude Artifacts)
// No external chart libraries: charts are hand-rolled inline SVG. Icons are inline SVG.
// Default export: <StochOptDashboard />

import React, { useState, useMemo, useCallback } from "react";

const ACCENT = "#2563EB";
const MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";
const SANS = "'Public Sans', ui-sans-serif, Helvetica, Arial, sans-serif";

const card = {
  background: "#fff",
  border: "1px solid rgba(226,232,240,0.8)",
  borderRadius: 12,
  boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
};
const metric = { fontFamily: MONO, fontWeight: 700, fontSize: 30, letterSpacing: "-0.02em", color: "#0F172A" };
const label = { fontSize: 12.5, color: "#64748B", fontWeight: 500 };
const caps = { fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748B" };
const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "9px", fontSize: 13, fontWeight: 600,
  color: "#0F172A", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 7,
  outline: "none", fontFamily: MONO,
};
const th = {
  textAlign: "right", padding: "10px 14px", fontSize: 11, fontWeight: 600,
  letterSpacing: "0.05em", textTransform: "uppercase", color: "#64748B", borderBottom: "1px solid #E2E8F0",
};
const td = { padding: "12px 14px", borderBottom: "1px solid #F1F5F9", textAlign: "right", fontFamily: MONO, color: "#334155" };

const fmt = (n, d) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n, d = 1) => (n * 100).toFixed(d) + "%";

/* ------------------------------------------------------------------ model */

function pmfOf(dist) {
  const mean = 5, Dmax = 22, a = [];
  if (dist === "Poisson") {
    let f = Math.exp(-mean);
    for (let d = 0; d <= Dmax; d++) { a.push(f); f = (f * mean) / (d + 1); }
  } else {
    const r = 3, q = r / (r + mean);
    let f = Math.pow(q, r);
    for (let d = 0; d <= Dmax; d++) { a.push(f); f = (f * (r + d) * (1 - q)) / (d + 1); }
  }
  const s = a.reduce((x, y) => x + y, 0);
  return a.map((v) => v / s);
}

function momentsOf(pm) {
  let m = 0, m2 = 0;
  pm.forEach((w, d) => { m += w * d; m2 += w * d * d; });
  return { mean: m, varr: m2 - m * m };
}

function solveMDP(P, dist) {
  const t0 = performance.now();
  const { B, C, K, c, h, p, gamma, L } = P;
  const pm = pmfOf(dist);
  const N = B + C + 1, idx = (x) => x + B;

  const stage = (x, q) => {
    let e = 0;
    for (let d = 0; d < pm.length; d++) { const y = x + q - d; e += pm[d] * (y >= 0 ? h * y : -p * y); }
    return (q > 0 ? K : 0) + c * q + e;
  };

  const SC = [], TR = [];
  for (let xi = 0; xi < N; xi++) {
    const x = xi - B, sc = [], tr = [];
    for (let q = 0; q <= C - x; q++) {
      sc.push(stage(x, q));
      const t = [];
      for (let d = 0; d < pm.length; d++) { let y = x + q - d; if (y < -B) y = -B; if (y > C) y = C; t.push(idx(y)); }
      tr.push(t);
    }
    SC.push(sc); TR.push(tr);
  }

  let V = new Float64Array(N), pol = new Int32Array(N), resid = 0, sweeps = 0;
  const residHist = [];
  for (let it = 0; it < 400; it++) {
    const nV = new Float64Array(N);
    for (let xi = 0; xi < N; xi++) {
      let best = Infinity, bq = 0;
      const sc = SC[xi], tr = TR[xi];
      for (let q = 0; q < sc.length; q++) {
        let ev = 0; const t = tr[q];
        for (let d = 0; d < pm.length; d++) ev += pm[d] * V[t[d]];
        const val = sc[q] + gamma * ev;
        if (val < best - 1e-9) { best = val; bq = q; }
      }
      nV[xi] = best; pol[xi] = bq;
    }
    resid = 0;
    for (let i = 0; i < N; i++) resid = Math.max(resid, Math.abs(nV[i] - V[i]));
    V = nV; sweeps = it + 1; residHist.push(resid);
    if (resid < 1e-6) break;
  }

  let s = -B, S = C;
  for (let xi = N - 1; xi >= 0; xi--) if (pol[xi] > 0) { s = xi - B; S = xi - B + pol[xi]; break; }

  // common demand stream
  const days = 90;
  const rng = ((seed) => { let z = seed >>> 0; return () => (z = (z * 1664525 + 1013904223) >>> 0) / 4294967296; })(20260920);
  const cdf = []; let acc = 0; pm.forEach((w) => { acc += w; cdf.push(acc); });
  const demand = [];
  for (let t = 0; t < days; t++) { const u = rng(); let d = 0; while (d < cdf.length - 1 && u > cdf[d]) d++; demand.push(d); }

  const sim = (order) => {
    let x = Math.round(S * 0.6), cost = 0, orders = 0, unmet = 0, tot = 0, onhand = 0, okDays = 0, soDays = 0, peak = x;
    const path = [x], marks = [];
    for (let t = 0; t < days; t++) {
      const q = Math.max(0, Math.min(C - x, order(x)));
      if (q > 0) { orders++; cost += K; marks.push(t); }
      cost += c * q;
      const y = x + q; peak = Math.max(peak, y);
      const d = demand[t]; tot += d;
      const served = Math.min(Math.max(y, 0), d);
      if (served >= d) okDays++; else { soDays++; unmet += d - served; }
      let nx = y - d; if (nx < -B) nx = -B; if (nx > C) nx = C;
      cost += nx >= 0 ? h * nx : -p * nx;
      onhand += Math.max(nx, 0);
      x = nx; path.push(x);
    }
    return {
      cost, avg: cost / days, csl: okDays / days, fill: 1 - unmet / tot, orders, path, marks,
      avgOnHand: onhand / days, backorders: Math.round(unmet), soDays, peak, cycle: orders ? days / orders : days,
    };
  };

  const mdp = sim((x) => pol[idx(Math.max(-B, Math.min(C, x)))]);
  const bs = sim((x) => (x < S ? S - x : 0));
  const mean = momentsOf(pm).mean;
  const eoqQ = Math.max(1, Math.round(Math.sqrt((2 * K * mean) / Math.max(h, 0.01))));
  const rop = Math.round(mean * L);
  const eoq = sim((x) => (x <= rop ? eoqQ : 0));

  const logs = residHist.map((v) => Math.log10(Math.max(v, 1e-8)));
  const lmax = Math.max(...logs), lmin = Math.min(...logs);
  const spark = logs.map((v) => (v - lmin) / Math.max(lmax - lmin, 1e-9));
  const bound = residHist.map((_, i) => Math.pow(gamma, i));

  return {
    V: Array.from(V), pol: Array.from(pol), s, S, B, C, mdp, bs, eoq, eoqQ, rop,
    resid, sweeps, ms: Math.round(performance.now() - t0), days,
    moments: momentsOf(pm), spark, bound,
  };
}

/* -------------------------------------------------------------------- UI */

const Icon = {
  box: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
    </svg>
  ),
  download: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  ),
  printer: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" />
    </svg>
  ),
};

function NumField({ name, value, onChange, step }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: "#475569" }}>{name}</span>
      <input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </label>
  );
}

export default function StochOptDashboard() {
  const [dist, setDist] = useState("Poisson");
  const [f, setF] = useState({ K: 64, c: 3, h: 1, p: 12, gamma: 0.97, L: 2, B: 10, C: 30 });
  const [tab, setTab] = useState("exec");
  const [hover, setHover] = useState(null);
  const [nonce, setNonce] = useState(0);
  const [lastRun, setLastRun] = useState("—");

  const P = useMemo(() => {
    const n = (v, d) => { const x = parseFloat(v); return isFinite(x) ? x : d; };
    return {
      K: n(f.K, 64), c: n(f.c, 3), h: n(f.h, 1), p: n(f.p, 12),
      gamma: Math.min(0.999, Math.max(0.5, n(f.gamma, 0.97))),
      L: Math.max(0, Math.round(n(f.L, 2))),
      B: Math.max(1, Math.min(40, Math.round(n(f.B, 10)))),
      C: Math.max(5, Math.min(60, Math.round(n(f.C, 30)))),
    };
  }, [f]);

  const r = useMemo(() => solveMDP(P, dist), [P, dist, nonce]);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const run = useCallback(() => { setNonce((n) => n + 1); setLastRun(new Date().toLocaleTimeString("en-GB")); }, []);

  const exportCsv = () => {
    const rows = [["policy", "avg_cost_per_period", "total_cost", "csl", "fill_rate", "orders"]];
    [["MDP (s,S)", r.mdp], ["Base-Stock", r.bs], ["Static EOQ", r.eoq]].forEach(([n, m]) =>
      rows.push([n, m.avg.toFixed(3), m.cost.toFixed(2), (m.csl * 100).toFixed(2), (m.fill * 100).toFixed(2), m.orders]));
    const blob = new Blob([rows.map((x) => x.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "stochopt-benchmark.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  /* geometry ------------------------------------------------------------ */
  const N = r.V.length, x0 = -r.B, x1 = r.C;
  const px = (x) => 48 + ((x - x0) / (x1 - x0)) * 842;
  const vmin = Math.min(...r.V), vmax = Math.max(...r.V);
  const py = (v) => 240 - ((v - vmin) / Math.max(vmax - vmin, 1e-6)) * 226;
  const vPoints = r.V.map((v, i) => `${px(i + x0).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const qmaxAll = Math.max(1, ...r.pol);
  const bw = Math.max(3, 842 / N - 2);

  const path = r.mdp.path, days = path.length;
  const lo = Math.min(-r.B, ...path), hi = Math.max(r.S + 2, ...path);
  const tx = (i) => 48 + (i / (days - 1)) * 842;
  const ty = (v) => 258 - ((v - lo) / Math.max(hi - lo, 1)) * 244;
  const simPoints = path.map((v, i) => `${tx(i).toFixed(1)},${ty(v).toFixed(1)}`).join(" ");
  const simArea = `${tx(0).toFixed(1)},${ty(0).toFixed(1)} ${simPoints} ${tx(days - 1).toFixed(1)},${ty(0).toFixed(1)}`;

  const nS = Math.max(r.spark.length - 1, 1);
  const sparkMdp = r.spark.map((v, i) => `${((i / nS) * 240).toFixed(1)},${(38 - v * 34).toFixed(1)}`).join(" ");
  const sparkBound = r.bound.map((v, i) => `${((i / nS) * 240).toFixed(1)},${(38 - v * 34).toFixed(1)}`).join(" ");

  const red = (r.eoq.cost - r.mdp.cost) / r.eoq.cost;
  const row = (name, tag, spec, m, color, bg, bd) => {
    const d = (r.eoq.cost - m.cost) / r.eoq.cost;
    return { name, tag, spec, m, color, bg, bd, d };
  };
  const rows = [
    row("MDP (s, S)", "OPT", `value iteration · γ=${P.gamma} · s=${r.s}, S=${r.S}`, r.mdp, "#1D4ED8", "#EFF6FF", "#BFDBFE"),
    row("Base-Stock", "HEUR", `order-up-to S=${r.S} every period`, r.bs, "#B45309", "#FFFBEB", "#FDE68A"),
    row("Static EOQ", "BASE", `Q=${r.eoqQ} · reorder point R=${r.rop}`, r.eoq, "#475569", "#F1F5F9", "#E2E8F0"),
  ];

  const tabBtn = (on) => ({
    appearance: "none", cursor: "pointer", padding: "9px 16px", fontSize: 13.5, fontWeight: 600,
    whiteSpace: "nowrap", borderRadius: 8,
    ...(on
      ? { color: "#fff", background: ACCENT, border: `1px solid ${ACCENT}`, boxShadow: "0 1px 2px rgba(15,23,42,0.12)" }
      : { color: "#475569", background: "#fff", border: "1px solid #E2E8F0" }),
  });
  const distBtn = (on) => ({
    appearance: "none", cursor: "pointer", padding: "10px 0", fontSize: 12.5, fontWeight: 600, borderRadius: 7,
    border: `1px solid ${on ? ACCENT : "#E2E8F0"}`, background: on ? "#EFF6FF" : "#fff", color: on ? "#1D4ED8" : "#475569",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: SANS, color: "#0F172A" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(255,255,255,0.94)", backdropFilter: "blur(8px)", borderBottom: "1px solid #E2E8F0" }}>
        <div style={{ maxWidth: 1560, margin: "0 auto", padding: "0 24px", height: 68, display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>{Icon.box}</div>
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>StochOpt Enterprise</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: "#475569", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 5, padding: "3px 7px" }}>v1.5.0</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 10px", borderRadius: 999, background: "#ECFDF5", border: "1px solid #A7F3D0" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 0 3px rgba(16,185,129,0.18)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#047857" }}>API Online</span>
          </div>
          <div style={{ flex: 1 }} />
          <nav style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 13, color: "#475569" }}>
            <a href="#" style={{ color: "#475569", textDecoration: "none" }}>Docs</a>
            <a href="#" style={{ color: "#475569", textDecoration: "none" }}>GitHub</a>
          </nav>
        </div>
      </header>

      <div style={{ maxWidth: 1560, margin: "0 auto", padding: "20px 24px 48px", display: "grid", gridTemplateColumns: "302px minmax(0,1fr)", gap: 20, alignItems: "start" }}>
        {/* sidebar */}
        <aside style={{ ...card, alignSelf: "stretch", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #F1F5F9", fontSize: 13, fontWeight: 600 }}>Parameter Cockpit</div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, flex: 1, justifyContent: "space-between" }}>
            <div>
              <div style={{ ...caps, marginBottom: 8 }}>Demand Distribution</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <button style={distBtn(dist === "Poisson")} onClick={() => setDist("Poisson")}>Poisson</button>
                <button style={distBtn(dist === "NegBin")} onClick={() => setDist("NegBin")}>NegBin</button>
              </div>
              <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 11, color: "#64748B" }}>
                E[D] = {fmt(r.moments.mean, 2)} · Var[D] = {fmt(r.moments.varr, 2)}
              </div>
            </div>

            <div>
              <div style={{ ...caps, marginBottom: 8 }}>Cost Parameters</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <NumField name="K · setup" value={f.K} onChange={set("K")} />
                <NumField name="c · unit" value={f.c} onChange={set("c")} />
                <NumField name="h · holding" value={f.h} onChange={set("h")} />
                <NumField name="p · shortage" value={f.p} onChange={set("p")} />
              </div>
            </div>

            <div>
              <div style={{ ...caps, marginBottom: 8 }}>MDP Parameters</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <NumField name="γ · discount" value={f.gamma} onChange={set("gamma")} step="0.01" />
                <NumField name="L · lead time" value={f.L} onChange={set("L")} />
                <NumField name="B · backlog" value={f.B} onChange={set("B")} />
                <NumField name="C · capacity" value={f.C} onChange={set("C")} />
              </div>
            </div>

            <button
              onClick={run}
              style={{ appearance: "none", border: "none", cursor: "pointer", width: "100%", padding: "14px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", background: ACCENT }}
            >
              Run Optimization &amp; Simulation
            </button>

            <div style={{ fontFamily: MONO, fontSize: 10.5, color: "#94A3B8", lineHeight: 1.6, borderTop: "1px solid #F1F5F9", paddingTop: 12 }}>
              solver: value-iteration<br />states: {P.B + P.C + 1} · horizon: {r.days}d<br />last run: {lastRun}
            </div>
          </div>
        </aside>

        <main style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          {/* KPI cards */}
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 16 }}>
            <div style={{ ...card, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={label}>Total Cost Reduction</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#15803D", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 999, padding: "2px 8px" }}>vs EOQ</span>
              </div>
              <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={metric}>{pct(red)}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#15803D" }}>▲ optimal</span>
              </div>
              <svg viewBox="0 0 240 40" preserveAspectRatio="none" style={{ width: "100%", height: 40, marginTop: 10, display: "block" }}>
                <polyline points={sparkBound} fill="none" stroke="#CBD5E1" strokeWidth="1.5" />
                <polyline points={sparkMdp} fill="none" stroke={ACCENT} strokeWidth="2" />
              </svg>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: "#94A3B8" }}>Bellman residual convergence</div>
            </div>

            <div style={{ ...card, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={label}>Computed Policy</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 999, padding: "2px 8px" }}>(s, S)</span>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "baseline" }}>
                <span style={metric}>s={r.s}</span><span style={metric}>S={r.S}</span>
              </div>
              <div style={{ marginTop: 14, height: 8, borderRadius: 999, background: "#F1F5F9", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, bottom: 0, borderRadius: 999, background: ACCENT, left: `${((r.s + r.B) / (r.B + r.C)) * 100}%`, width: `${((r.S - r.s) / (r.B + r.C)) * 100}%` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10.5, color: "#94A3B8", marginTop: 6 }}>
                <span>order band {r.S - r.s} units</span><span>cap {P.C}</span>
              </div>
            </div>

            <div style={{ ...card, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={label}>Cycle Service Level</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 999, padding: "2px 8px" }}>CSL</span>
              </div>
              <div style={{ marginTop: 10 }}><span style={metric}>{pct(r.mdp.csl)}</span></div>
              <div style={{ marginTop: 14, height: 8, borderRadius: 999, background: "#F1F5F9", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 999, background: ACCENT, width: `${r.mdp.csl * 100}%` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10.5, color: "#94A3B8", marginTop: 6 }}>
                <span>no-stockout cycles</span><span>target 95%</span>
              </div>
            </div>

            <div style={{ ...card, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={label}>Fill Rate</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#15803D", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 999, padding: "2px 8px" }}>β-service</span>
              </div>
              <div style={{ marginTop: 10 }}><span style={metric}>{pct(r.mdp.fill)}</span></div>
              <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6, fontFamily: MONO, fontSize: 11, color: "#475569" }}>
                <span style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "3px 8px" }}>avg on-hand {fmt(r.mdp.avgOnHand, 1)}</span>
                <span style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "3px 8px" }}>backorders {r.mdp.backorders}</span>
              </div>
            </div>
          </section>

          {/* tabs */}
          <section style={{ ...card, minWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "9px 16px", borderBottom: "1px solid #F1F5F9" }}>
              <button style={tabBtn(tab === "exec")} onClick={() => setTab("exec")}>Executive Summary</button>
              <button style={tabBtn(tab === "policy")} onClick={() => setTab("policy")}>Policy Explorer</button>
              <button style={tabBtn(tab === "sim")} onClick={() => setTab("sim")}>Monte Carlo Trajectory</button>
            </div>

            {tab === "exec" && (
              <div style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Benchmark Comparison</div>
                    <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>Common demand stream, {r.days} periods, identical cost structure.</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={exportCsv} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#334155", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>
                      {Icon.download} Export CSV
                    </button>
                    <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#334155", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>
                      {Icon.printer} Export PDF
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 660 }}>
                    <thead>
                      <tr style={{ background: "#F8FAFC" }}>
                        <th style={{ ...th, textAlign: "left" }}>Policy</th>
                        <th style={th}>Avg Cost / Period</th><th style={th}>Total Cost</th>
                        <th style={th}>CSL</th><th style={th}>Fill Rate</th><th style={th}>Orders</th><th style={th}>Δ vs EOQ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((x) => (
                        <tr key={x.name}>
                          <td style={{ ...td, textAlign: "left", fontFamily: SANS }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, padding: "2px 6px", borderRadius: 5, color: x.color, background: x.bg, border: `1px solid ${x.bd}` }}>{x.tag}</span>
                              <span style={{ fontWeight: 600, color: "#0F172A" }}>{x.name}</span>
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: 11, color: "#94A3B8", marginTop: 3 }}>{x.spec}</div>
                          </td>
                          <td style={{ ...td, fontWeight: 700, color: "#0F172A" }}>{fmt(x.m.avg, 2)}</td>
                          <td style={td}>{fmt(x.m.cost, 0)}</td>
                          <td style={td}>{pct(x.m.csl)}</td>
                          <td style={td}>{pct(x.m.fill)}</td>
                          <td style={td}>{x.m.orders}</td>
                          <td style={td}>
                            <span style={{
                              fontFamily: MONO, fontSize: 11.5, fontWeight: 600, padding: "3px 8px", borderRadius: 999,
                              ...(x.d > 0.0005
                                ? { color: "#15803D", background: "#F0FDF4", border: "1px solid #BBF7D0" }
                                : { color: "#64748B", background: "#F1F5F9", border: "1px solid #E2E8F0" }),
                            }}>
                              {(x.d >= 0 ? "−" : "+") + Math.abs(x.d * 100).toFixed(1) + "%"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 16 }}>
                  {[
                    ["Optimality gap", r.resid < 1e-5 ? "< 1e-5" : r.resid.toExponential(1), "Bellman residual at termination."],
                    ["Solve time", `${r.ms} ms`, `${r.sweeps} sweeps over ${P.B + P.C + 1} states.`],
                    ["Expected discounted cost", fmt(r.V[r.B], 1), `V*(0) under γ = ${P.gamma}.`],
                  ].map(([t, v, s]) => (
                    <div key={t} style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: 14, background: "#F8FAFC" }}>
                      <div style={caps}>{t}</div>
                      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 20, marginTop: 6 }}>{v}</div>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{s}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "policy" && (
              <div style={{ padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>V*(x) and the optimal decision rule</div>
                <div style={{ fontSize: 12.5, color: "#64748B", margin: "2px 0 8px" }}>Hover the chart to inspect a state.</div>

                <svg
                  viewBox="0 0 900 300" preserveAspectRatio="none"
                  style={{ width: "100%", height: 300, display: "block", cursor: "crosshair" }}
                  onMouseMove={(e) => {
                    const b = e.currentTarget.getBoundingClientRect();
                    const rel = ((e.clientX - b.left) / b.width) * 900;
                    const i = Math.round(((rel - 48) / 842) * (N - 1));
                    if (i >= 0 && i < N) setHover(i);
                  }}
                  onMouseLeave={() => setHover(null)}
                >
                  {[0, 1, 2, 3].map((i) => <line key={i} x1="48" x2="890" y1={14 + i * 60} y2={14 + i * 60} stroke="#F1F5F9" />)}
                  {r.pol.map((q, i) => {
                    const hgt = (q / qmaxAll) * 120;
                    return <rect key={i} x={px(i + x0) - bw / 2} y={252 - hgt} width={bw} height={hgt} fill="#BFDBFE" rx="1" />;
                  })}
                  <line x1={px(r.s)} x2={px(r.s)} y1="14" y2="252" stroke="#DC2626" strokeWidth="1.5" strokeDasharray="4 4" />
                  <line x1={px(r.S)} x2={px(r.S)} y1="14" y2="252" stroke="#16A34A" strokeWidth="1.5" strokeDasharray="4 4" />
                  <polyline points={vPoints} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinejoin="round" />
                  <line x1="48" x2="890" y1="252" y2="252" stroke="#CBD5E1" />
                  {Array.from({ length: 9 }, (_, k) => x0 + Math.round(((x1 - x0) / 8) * k)).map((x) => (
                    <text key={x} x={px(x)} y="270" textAnchor="middle" fontSize="11" fontFamily={MONO} fill="#94A3B8">{x}</text>
                  ))}
                  <text x={px(r.s)} y="288" textAnchor="middle" fontSize="11" fontFamily={MONO} fill="#DC2626">s = {r.s}</text>
                  <text x={px(r.S)} y="288" textAnchor="middle" fontSize="11" fontFamily={MONO} fill="#16A34A">S = {r.S}</text>
                </svg>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", fontFamily: MONO, fontSize: 12 }}>
                  <span style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 7, padding: "6px 10px", color: "#334155" }}>
                    {hover == null ? "x = —   V*(x) = —   μ*(x) = —" : `x = ${hover + x0}   V*(x) = ${fmt(r.V[hover], 1)}   μ*(x) = ${r.pol[hover]}`}
                  </span>
                  <span style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 7, padding: "6px 10px", color: "#334155" }}>
                    rule: order (S − x) if x ≤ s, else 0
                  </span>
                </div>
              </div>
            )}

            {tab === "sim" && (
              <div style={{ padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Inventory trajectory · {r.days} days</div>
                <div style={{ fontSize: 12.5, color: "#64748B", margin: "2px 0 8px" }}>Single Monte Carlo path of the on-hand position under the computed policy.</div>

                <svg viewBox="0 0 900 320" preserveAspectRatio="none" style={{ width: "100%", height: 320, display: "block" }}>
                  {[0, 1, 2, 3, 4].map((i) => <line key={i} x1="48" x2="890" y1={14 + i * 61} y2={14 + i * 61} stroke="#F1F5F9" />)}
                  <rect x="48" y={ty(0)} width="842" height={Math.max(0, 258 - ty(0))} fill="#FEF2F2" />
                  <line x1="48" x2="890" y1={ty(0)} y2={ty(0)} stroke="#CBD5E1" />
                  <polyline points={simArea} fill="rgba(37,99,235,0.07)" stroke="none" />
                  <polyline points={simPoints} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" />
                  {r.mdp.marks.map((i) => <circle key={i} cx={tx(i)} cy={ty(path[i])} r="3" fill="#fff" stroke={ACCENT} strokeWidth="1.5" />)}
                  <line x1="48" x2="890" y1={ty(r.s)} y2={ty(r.s)} stroke="#DC2626" strokeWidth="1.5" strokeDasharray="5 4" />
                  <line x1="48" x2="890" y1={ty(r.S)} y2={ty(r.S)} stroke="#16A34A" strokeWidth="1.5" strokeDasharray="5 4" />
                  <text x="120" y={ty(r.s) - 6} fontSize="11" fontFamily={MONO} fill="#DC2626">s = {r.s}</text>
                  <text x="120" y={ty(r.S) - 6} fontSize="11" fontFamily={MONO} fill="#16A34A">S = {r.S}</text>
                  {Array.from({ length: Math.ceil(days / 15) }, (_, k) => k * 15).map((i) => (
                    <text key={i} x={tx(i)} y="304" textAnchor="middle" fontSize="11" fontFamily={MONO} fill="#94A3B8">d{i}</text>
                  ))}
                </svg>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginTop: 14 }}>
                  {[
                    ["Replenishments", r.mdp.orders],
                    ["Stockout days", r.mdp.soDays],
                    ["Peak on-hand", r.mdp.peak],
                    ["Avg cycle length", `${fmt(r.mdp.cycle, 1)} d`],
                  ].map(([t, v]) => (
                    <div key={t} style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 14px" }}>
                      <div style={caps}>{t}</div>
                      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 19, marginTop: 5 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
