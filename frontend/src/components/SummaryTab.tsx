import { Download, FileText } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { downloadReport, saveBlob } from "@/lib/api";
import { convergenceSpark, num, pct, savingsPct } from "@/lib/analysis";
import { COLORS } from "@/lib/colors";
import type { AnalysisResult, PolicyMetrics } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, Card, CardContent } from "./ui/primitives";

/* ------------------------------------------------------------- KPI cards */

const PILL = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  grey: "border-slate-200 bg-slate-100 text-slate-600",
  red: "border-rose-200 bg-rose-50 text-rose-700",
} as const;

function KpiShell({
  label,
  badge,
  badgeTone,
  children,
}: {
  label: string;
  badge: string;
  badgeTone: keyof typeof PILL;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-[18px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-medium text-slate-500">{label}</span>
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", PILL[badgeTone])}>
            {badge}
          </span>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

const BIG = "font-mono text-[30px] font-bold leading-none tracking-tight text-slate-900";
const FOOT = "font-mono text-[10.5px] text-slate-400";

function ProgressBar({ start, end }: { start: number; end: number }) {
  const l = Math.min(1, Math.max(0, start));
  const w = Math.min(1 - l, Math.max(0.02, end - start));
  return (
    <div className="relative mt-3.5 h-2 overflow-hidden rounded-full bg-slate-100" role="presentation">
      <div className="absolute inset-y-0 rounded-full bg-blue-600" style={{ left: `${l * 100}%`, width: `${w * 100}%` }} />
    </div>
  );
}

/** Plain-language read of the share of days that end out of stock. */
function stockoutRisk(ratio: number): string {
  return ratio <= 0.05 ? "Low" : ratio <= 0.15 ? "Medium" : "High";
}

export function KpiRow({ result }: { result: AnalysisResult }) {
  const { optimize: opt, simulate: sim, request } = result;
  const vsBase = savingsPct(sim.mdp, sim.basestock);
  const vsEoq = savingsPct(sim.mdp, sim.static_eoq);
  const L = request.bounds.lead_time;
  const cap = request.bounds.capacity;
  const spark = convergenceSpark(opt.iterations, request.bounds.gamma, result.residualHistory);
  const lo = Math.min(...opt.states);
  const span = Math.max(...opt.states) - lo || 1;
  const hasPolicy = opt.s !== null && opt.S !== null;

  return (
    <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
      <KpiShell label="Cost Savings" badge="vs Traditional" badgeTone={vsBase >= 0 ? "green" : "red"}>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className={BIG} data-testid="kpi-value">
            {`${vsBase >= 0 ? "" : "−"}${Math.abs(vsBase).toFixed(1)}%`}
          </span>
          <span className={cn("text-xs font-semibold", vsEoq >= 0 ? "text-emerald-700" : "text-rose-700")}>
            {vsEoq >= 0 ? "▲" : "▼"} {Math.abs(vsEoq).toFixed(1)}% vs EOQ baseline
          </span>
        </div>
        <div className="mt-2.5 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <Line type="monotone" dataKey="bench" stroke="#CBD5E1" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="value" stroke={COLORS.primary} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className={cn(FOOT, "mt-0.5")}>Optimal inventory cost reduction</div>
      </KpiShell>

      <KpiShell
        label={L > 0 ? "Reorder Rule · Inv. Position" : "Reorder Rule"}
        badge="(s, S)"
        badgeTone={opt.is_s_S_optimal || !hasPolicy ? "blue" : "red"}
      >
        <div className="mt-2.5 flex items-baseline gap-2.5" data-testid="kpi-value">
          {hasPolicy ? (
            <>
              <span className={BIG}>{`s=${opt.s}`}</span> <span className={BIG}>{`S=${opt.S}`}</span>
            </>
          ) : (
            <span className={BIG}>—</span>
          )}
        </div>
        <ProgressBar
          start={hasPolicy ? ((opt.s ?? 0) - lo) / span : 0}
          end={hasPolicy ? ((opt.S ?? 0) - lo) / span : 0}
        />
        <div className={cn(FOOT, "mt-1.5 flex justify-between")}>
          <span>
            {hasPolicy
              ? `Order ${(opt.S ?? 0) - (opt.s ?? 0)} units when inventory hits ${opt.s} (Cap: ${cap})${opt.is_s_S_optimal ? "" : " · not a pure (s, S)"}`
              : `Never reorders within the modelled range (Cap: ${cap})`}
          </span>
        </div>
      </KpiShell>

      <KpiShell label="Stockout Prevention" badge="CSL" badgeTone="grey">
        <div className="mt-2.5">
          <span className={BIG} data-testid="kpi-value">
            {pct(sim.mdp.csl)}
          </span>
        </div>
        <ProgressBar start={0} end={sim.mdp.csl} />
        <div className={cn(FOOT, "mt-1.5 flex justify-between")}>
          <span>Zero-stockout cycles (Target 95%)</span>
        </div>
      </KpiShell>

      <KpiShell label="Demand Fulfillment" badge="Fill Rate" badgeTone="green">
        <div className="mt-2.5">
          <span className={BIG} data-testid="kpi-value">
            {pct(sim.mdp.fill_rate)}
          </span>
        </div>
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {[`Avg on-hand: ${num(sim.mdp.mean_on_hand, 1)} units`, `Stockout risk: ${stockoutRisk(sim.mdp.stockout_days_ratio)}`].map((t) => (
            <span key={t} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-[3px] font-mono text-[11px] text-slate-600">
              {t}
            </span>
          ))}
        </div>
      </KpiShell>
    </section>
  );
}

/* ------------------------------------------------------ benchmark table */

const ROWS: {
  key: "mdp" | "basestock" | "static_eoq";
  name: string;
  tag: string;
  badge: string;
  spec: (r: AnalysisResult) => string;
}[] = [
  {
    key: "mdp",
    name: "MDP (s, S)",
    tag: "OPT",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    spec: () => "Smart dynamic replenishment (optimal)",
  },
  { key: "basestock", name: "Base-Stock", tag: "HEUR", badge: "border-amber-200 bg-amber-50 text-amber-700", spec: () => "Fixed order-up-to policy (heuristic)" },
  { key: "static_eoq", name: "Static EOQ", tag: "BASE", badge: "border-slate-200 bg-slate-100 text-slate-600", spec: () => "Standard fixed quantity baseline" },
];

const TH = "border-b border-slate-200 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500";
const TD = "px-3.5 py-3 text-right font-mono text-slate-700";

export function BenchmarkTable({ result }: { result: AnalysisResult }) {
  const data = result.simulate;
  const eoq = data.static_eoq.mean_cost;
  return (
    <div className="overflow-x-auto rounded-[10px] border border-slate-200">
      <table className="w-full min-w-[760px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-slate-50">
            <th className={cn(TH, "text-left")}>Strategy</th>
            <th className={cn(TH, "text-right")}>Avg daily cost</th>
            <th className={cn(TH, "text-right")}>Total run cost</th>
            <th className={cn(TH, "text-right")}>No-stockout rate</th>
            <th className={cn(TH, "text-right")}>Fulfillment rate</th>
            <th className={cn(TH, "text-right")}>Out-of-stock days</th>
            <th className={cn(TH, "text-right")}>Avg inventory</th>
            <th className={cn(TH, "text-right")}>Savings vs baseline</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ROWS.map(({ key, name, tag, badge, spec }) => {
            const m: PolicyMetrics = data[key];
            const d = (eoq - m.mean_cost) / eoq;
            const better = d > 0.0005;
            return (
              <tr key={key} className="hover:bg-slate-50">
                <td className="px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-[5px] border px-1.5 py-0.5 font-mono text-[10.5px] font-semibold", badge)}>{tag}</span>
                    <span className="font-semibold text-slate-900">{name}</span>
                  </div>
                  <div className="mt-[3px] font-mono text-[11px] text-slate-400">{spec(result)}</div>
                </td>
                <td className={cn(TD, "font-bold text-slate-900")}>
                  {num(m.mean_cost, 3)} <span className="font-normal text-slate-400">± {num(m.cost_stderr, 3)}</span>
                </td>
                <td className={TD}>{num(m.mean_cost * result.request.T, 0)}</td>
                <td className={TD}>{pct(m.csl)}</td>
                <td className={TD}>{pct(m.fill_rate)}</td>
                <td className={TD}>{pct(m.stockout_days_ratio)}</td>
                <td className={TD}>{num(m.mean_on_hand)}</td>
                <td className="px-3.5 py-3 text-right">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-[3px] font-mono text-[11.5px] font-semibold",
                      better ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500",
                    )}
                  >
                    {(d >= 0 ? "−" : "+") + Math.abs(d * 100).toFixed(1) + "%"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------------------------------------- export bar */

export function ExportButtons({ request }: { request: AnalysisResult["request"] }) {
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "csv" | "pdf") {
    setBusy(kind);
    setError(null);
    try {
      saveBlob(
        await downloadReport(kind, request),
        kind === "csv" ? "benchmark.csv" : "inventory_policy_summary.pdf",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <Button variant="outline" className="h-auto gap-1.5 rounded-lg px-3 py-[7px] text-[12.5px] font-semibold" loading={busy === "csv"} disabled={busy !== null} onClick={() => void run("csv")}>
          {busy !== "csv" && <Download className="h-3.5 w-3.5" aria-hidden />} Export CSV
        </Button>
        <Button variant="outline" className="h-auto gap-1.5 rounded-lg px-3 py-[7px] text-[12.5px] font-semibold" loading={busy === "pdf"} disabled={busy !== null} onClick={() => void run("pdf")}>
          {busy !== "pdf" && <FileText className="h-3.5 w-3.5" aria-hidden />} Export PDF
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ tab */

function Stat({ label, value, note }: { label: string; value: string; note: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-slate-200 bg-slate-50 p-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1.5 font-mono text-xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{note}</div>
    </div>
  );
}

export function SummaryTab({ result }: { result: AnalysisResult }) {
  const { optimize: opt, simulate: sim, request } = result;
  // value-iteration error bound: ‖V − V*‖ ≤ γ/(1 − γ) · residual, relative to the value at x = 0
  const { gamma } = request.bounds;
  const relErr = ((gamma / (1 - gamma)) * opt.residual) / Math.max(Math.abs(sim.theoretical_cost), 1e-9);
  const accuracy = 100 * (1 - relErr);
  const accuracyLabel = accuracy >= 99.9 ? "> 99.9% optimal" : `${accuracy.toFixed(2)}% optimal`;

  return (
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">Strategy Benchmark</div>
          <div className="mt-0.5 text-[12.5px] text-slate-500">
            Performance comparison across {request.T} simulated periods under identical demand
          </div>
        </div>
        <ExportButtons request={request} />
      </div>

      <BenchmarkTable result={result} />

      <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <Stat label="Algorithm Accuracy" value={accuracyLabel} note="Verified Bellman convergence" />
        <Stat label="Solve Latency" value={result.solveMs === undefined ? "—" : `${result.solveMs} ms`} note="Real-time decision matrix" />
        <Stat label="Estimated Total Cost" value={num(sim.theoretical_cost, 1)} note="Projected long-term operating cost" />
      </div>
    </div>
  );
}
