import { Download, FileText } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { useI18n } from "@/i18n/context";
import { describeError } from "@/i18n/describe-error";
import { downloadReport, saveBlob } from "@/lib/api";
import { convergenceSpark, savingsPct } from "@/lib/analysis";
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
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="text-[12.5px] font-medium text-slate-500">{label}</span>
          <span className={cn("whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold", PILL[badgeTone])}>
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
function stockoutRisk(ratio: number): "low" | "medium" | "high" {
  return ratio <= 0.05 ? "low" : ratio <= 0.15 ? "medium" : "high";
}

export function KpiRow({ result }: { result: AnalysisResult }) {
  const { t, f } = useI18n();
  const { optimize: opt, simulate: sim, request } = result;
  const vsBase = savingsPct(sim.mdp, sim.basestock);
  const vsEoq = savingsPct(sim.mdp, sim.static_eoq);
  const L = request.bounds.lead_time;
  const cap = request.bounds.capacity;
  const spark = convergenceSpark(opt.iterations, request.bounds.gamma, result.residualHistory);
  const lo = Math.min(...opt.states);
  const span = Math.max(...opt.states) - lo || 1;
  const hasPolicy = opt.s !== null && opt.S !== null;
  const rule = t.kpi.rule;

  return (
    <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
      <KpiShell label={t.kpi.savings.label} badge={t.kpi.savings.badge} badgeTone={vsBase >= 0 ? "green" : "red"}>
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={BIG} data-testid="kpi-value">
            {`${vsBase >= 0 ? "" : "−"}${f.pct(Math.abs(vsBase) / 100)}`}
          </span>
          <span className={cn("text-xs font-semibold", vsEoq >= 0 ? "text-emerald-700" : "text-rose-700")}>
            {t.kpi.savings.vsEoq(vsEoq >= 0, f.pct(Math.abs(vsEoq) / 100))}
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
        <div className={cn(FOOT, "mt-0.5")}>{t.kpi.savings.note}</div>
      </KpiShell>

      <KpiShell
        label={L > 0 ? rule.labelWithOrders : rule.label}
        badge={rule.badge}
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
              ? `${(L > 0 ? rule.textWithOrders : rule.text)(opt.s ?? 0, opt.S ?? 0, cap)}${opt.is_s_S_optimal ? "" : rule.notPure}`
              : rule.none(cap)}
          </span>
        </div>
      </KpiShell>

      <KpiShell label={t.kpi.service.label} badge={t.kpi.service.badge} badgeTone="grey">
        <div className="mt-2.5">
          <span className={BIG} data-testid="kpi-value">
            {f.pct(sim.mdp.csl)}
          </span>
        </div>
        <ProgressBar start={0} end={sim.mdp.csl} />
        <div className={cn(FOOT, "mt-1.5 flex justify-between")}>
          <span>{t.kpi.service.note}</span>
        </div>
      </KpiShell>

      <KpiShell label={t.kpi.fill.label} badge={t.kpi.fill.badge} badgeTone="green">
        <div className="mt-2.5">
          <span className={BIG} data-testid="kpi-value">
            {f.pct(sim.mdp.fill_rate)}
          </span>
        </div>
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {[
            t.kpi.fill.avgStock(f.num(sim.mdp.mean_on_hand, 1)),
            t.kpi.fill.risk(t.kpi.fill[stockoutRisk(sim.mdp.stockout_days_ratio)]),
          ].map((text) => (
            <span key={text} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-[3px] font-mono text-[11px] text-slate-600">
              {text}
            </span>
          ))}
        </div>
      </KpiShell>
    </section>
  );
}

/* ------------------------------------------------------ benchmark table */

const ROWS = [
  { key: "mdp", badge: "border-blue-200 bg-blue-50 text-blue-700" },
  { key: "basestock", badge: "border-amber-200 bg-amber-50 text-amber-700" },
  { key: "static_eoq", badge: "border-slate-200 bg-slate-100 text-slate-600" },
] as const;

const TH = "border-b border-slate-200 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500";
const TD = "px-3.5 py-3 text-right font-mono text-slate-700";

export function BenchmarkTable({ result }: { result: AnalysisResult }) {
  const { t, f } = useI18n();
  const data = result.simulate;
  const eoq = data.static_eoq.mean_cost;
  const col = t.summary.columns;
  return (
    <div className="overflow-x-auto rounded-[10px] border border-slate-200">
      <table className="w-full min-w-[760px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-slate-50">
            <th className={cn(TH, "text-left")}>{col.rule}</th>
            <th className={cn(TH, "text-right")} title={t.summary.hints.costPerDay}>
              {col.costPerDay}
            </th>
            <th className={cn(TH, "text-right")}>{col.totalCost}</th>
            <th className={cn(TH, "text-right")}>{col.noShortage}</th>
            <th className={cn(TH, "text-right")}>{col.served}</th>
            <th className={cn(TH, "text-right")}>{col.outOfStock}</th>
            <th className={cn(TH, "text-right")}>{col.avgStock}</th>
            <th className={cn(TH, "text-right")} title={t.summary.hints.saving}>
              {col.saving}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ROWS.map(({ key, badge }) => {
            const m: PolicyMetrics = data[key];
            const rule = t.summary.rules[key];
            const d = (eoq - m.mean_cost) / eoq;
            const better = d > 0.0005;
            return (
              <tr key={key} className="hover:bg-slate-50">
                <td className="px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-[5px] border px-1.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase", badge)}>
                      {rule.tag}
                    </span>
                    <span className="font-semibold text-slate-900">{rule.name}</span>
                  </div>
                  <div className="mt-[3px] text-[11px] text-slate-500">{rule.spec}</div>
                </td>
                <td className={cn(TD, "whitespace-nowrap font-bold text-slate-900")}>
                  {f.num(m.mean_cost, 3)} <span className="font-normal text-slate-400">± {f.num(m.cost_stderr, 3)}</span>
                </td>
                <td className={TD}>{f.num(m.mean_cost * result.request.T, 0)}</td>
                <td className={TD}>{f.pct(m.csl)}</td>
                <td className={TD}>{f.pct(m.fill_rate)}</td>
                <td className={TD}>{f.pct(m.stockout_days_ratio)}</td>
                <td className={TD}>{f.num(m.mean_on_hand)}</td>
                <td className="px-3.5 py-3 text-right">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-[3px] font-mono text-[11.5px] font-semibold",
                      better ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500",
                    )}
                  >
                    {key === "static_eoq" ? "—" : (d >= 0 ? "−" : "+") + f.pct(Math.abs(d))}
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
  const { t } = useI18n();
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function run(kind: "csv" | "pdf") {
    setBusy(kind);
    setError(null);
    try {
      saveBlob(
        await downloadReport(kind, request),
        kind === "csv" ? "benchmark.csv" : "inventory_policy_summary.pdf",
      );
    } catch (e) {
      setError(e ?? new Error());
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <Button variant="outline" className="h-auto gap-1.5 rounded-lg px-3 py-[7px] text-[12.5px] font-semibold" loading={busy === "csv"} disabled={busy !== null} onClick={() => void run("csv")}>
          {busy !== "csv" && <Download className="h-3.5 w-3.5" aria-hidden />} {t.summary.export.csv}
        </Button>
        <Button variant="outline" className="h-auto gap-1.5 rounded-lg px-3 py-[7px] text-[12.5px] font-semibold" loading={busy === "pdf"} disabled={busy !== null} onClick={() => void run("pdf")}>
          {busy !== "pdf" && <FileText className="h-3.5 w-3.5" aria-hidden />} {t.summary.export.pdf}
        </Button>
      </div>
      {error !== null && (
        <p role="alert" className="text-xs text-rose-600">
          {describeError(error, t)}
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
  const { t, f } = useI18n();
  const { optimize: opt, simulate: sim, request } = result;
  // value-iteration error bound: ‖V − V*‖ ≤ γ/(1 − γ) · residual, relative to the value at x = 0
  const { gamma } = request.bounds;
  const relErr = ((gamma / (1 - gamma)) * opt.residual) / Math.max(Math.abs(sim.theoretical_cost), 1e-9);
  const accuracy = 100 * (1 - relErr);
  const accuracyLabel = accuracy >= 99.9 ? `> ${f.pct(0.999)}` : f.pct(accuracy / 100, 2);
  const stats = t.summary.stats;

  return (
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">{t.summary.title}</div>
          <div className="mt-0.5 text-[12.5px] text-slate-500">{t.summary.subtitle(request.T)}</div>
        </div>
        <ExportButtons request={request} />
      </div>

      <BenchmarkTable result={result} />

      <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <Stat label={stats.accuracy.label} value={accuracyLabel} note={stats.accuracy.note} />
        <Stat
          label={stats.latency.label}
          value={result.solveMs === undefined ? "—" : `${result.solveMs} ms`}
          note={stats.latency.note}
        />
        <Stat label={stats.cost.label} value={f.num(sim.theoretical_cost, 1)} note={stats.cost.note} />
      </div>
    </div>
  );
}
