import { TriangleAlert } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { optimize, simulate } from "@/lib/api";
import { getDemoResult } from "@/lib/demo";
import { DEFAULT_FORM, type FormValues, toOptimizeRequest, toSimulateRequest, validateForm } from "@/lib/form";
import type { AnalysisResult } from "@/lib/types";
import { Header, useApiStatus } from "./components/Header";
import { PolicyTab } from "./components/PolicyTab";
import { Sidebar } from "./components/Sidebar";
import { KpiRow, SummaryTab } from "./components/SummaryTab";
import { TrajectoryTab } from "./components/TrajectoryTab";
import { TabPanel, Tabs } from "./components/ui/primitives";

const TABS = [
  { id: "summary", label: "Executive Summary" },
  { id: "policy", label: "Policy Explorer" },
  { id: "trajectory", label: "Monte Carlo Trajectory" },
];

function Console() {
  const status = useApiStatus();
  const [form, setForm] = useState<FormValues>(DEFAULT_FORM);
  const [tab, setTab] = useState("summary");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState("sample data");
  const [isDemo, setIsDemo] = useState(true);
  const [result, setResult] = useState<AnalysisResult>(getDemoResult);

  const errors = useMemo(() => validateForm(form), [form]);
  const patch = useCallback((p: Partial<FormValues>) => setForm((f) => ({ ...f, ...p })), []);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const t0 = performance.now();
      const request = toSimulateRequest(form);
      const [opt, sim] = await Promise.all([optimize(toOptimizeRequest(form)), simulate(request)]);
      setResult({ request, optimize: opt, simulate: sim, solveMs: Math.max(1, Math.round(performance.now() - t0)) });
      setIsDemo(false);
      setLastRun(new Date().toLocaleTimeString("en-GB"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header status={status} onToggleSidebar={() => setSidebarOpen((o) => !o)} />
      <div className="mx-auto grid w-full max-w-[1560px] items-start gap-5 px-4 pb-12 pt-5 lg:grid-cols-[302px_minmax(0,1fr)] lg:px-6">
        <Sidebar
          form={form}
          onChange={patch}
          onRun={() => void run()}
          loading={loading}
          errors={errors}
          open={sidebarOpen}
          lastRun={lastRun}
        />
        <main className="flex min-w-0 flex-col gap-5">
          <KpiRow result={result} />

          <section className="min-w-0 rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
              <Tabs items={TABS} value={tab} onChange={setTab} />
              {loading ? (
                <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" aria-hidden /> Updating…
                </span>
              ) : (
                isDemo && (
                  <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden />
                    Sample analysis · default parameters. Press Run for a live solve.
                  </span>
                )
              )}
            </div>

            {error && (
              <div role="alert" className="m-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {error}
              </div>
            )}

            <TabPanel id="summary" active={tab === "summary"}>
              <SummaryTab result={result} />
            </TabPanel>
            <TabPanel id="policy" active={tab === "policy"}>
              <PolicyTab opt={result.optimize} leadTime={result.request.bounds.lead_time} />
            </TabPanel>
            <TabPanel id="trajectory" active={tab === "trajectory"}>
              <TrajectoryTab
                trajectory={result.simulate.trajectory}
                opt={result.optimize}
                leadTime={result.request.bounds.lead_time}
              />
            </TabPanel>
          </section>
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 text-slate-900">
      <Console />
    </div>
  );
}
