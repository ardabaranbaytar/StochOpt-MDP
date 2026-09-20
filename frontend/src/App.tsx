import { Activity, LayoutDashboard, LineChart as LineIcon, Loader2, TriangleAlert } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { optimize, simulate } from "@/lib/api";
import { DEFAULT_FORM, type FormValues, toOptimizeRequest, toSimulateRequest, validateForm } from "@/lib/form";
import type { AnalysisResult } from "@/lib/types";
import { Header, useApiStatus } from "./components/Header";
import { PolicyTab } from "./components/PolicyTab";
import { Sidebar } from "./components/Sidebar";
import { SummaryTab } from "./components/SummaryTab";
import { TrajectoryTab } from "./components/TrajectoryTab";
import { TabPanel, Tabs } from "./components/ui/primitives";

const TABS = [
  { id: "summary", label: "Executive Summary", icon: <LayoutDashboard className="h-4 w-4" aria-hidden /> },
  { id: "policy", label: "Policy & Value Function", icon: <LineIcon className="h-4 w-4" aria-hidden /> },
  { id: "trajectory", label: "Monte Carlo Trajectory", icon: <Activity className="h-4 w-4" aria-hidden /> },
];

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-800 text-center">
      {loading ? (
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" aria-hidden />
      ) : (
        <LayoutDashboard className="h-8 w-8 text-zinc-600" aria-hidden />
      )}
      <p className="text-sm text-zinc-300">
        {loading ? "Solving the MDP and running the simulation…" : "No analysis yet"}
      </p>
      {!loading && (
        <p className="max-w-sm text-xs text-zinc-500">
          Set the parameters in the control panel and press{" "}
          <span className="text-emerald-400">Run Optimization &amp; Simulation</span>.
        </p>
      )}
    </div>
  );
}

export default function App() {
  const status = useApiStatus();
  const [form, setForm] = useState<FormValues>(DEFAULT_FORM);
  const [tab, setTab] = useState("summary");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const errors = useMemo(() => validateForm(form), [form]);
  const patch = useCallback((p: Partial<FormValues>) => setForm((f) => ({ ...f, ...p })), []);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const request = toSimulateRequest(form);
      const [opt, sim] = await Promise.all([optimize(toOptimizeRequest(form)), simulate(request)]);
      setResult({ request, optimize: opt, simulate: sim });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Header status={status} onToggleSidebar={() => setSidebarOpen((o) => !o)} />
      <div className="lg:flex">
        <Sidebar form={form} onChange={patch} onRun={() => void run()} loading={loading} errors={errors} open={sidebarOpen} />
        <main className="min-w-0 flex-1 space-y-5 p-4 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs items={TABS} value={tab} onChange={setTab} />
            {loading && result && (
              <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Updating…
              </span>
            )}
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-300">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </div>
          )}

          {result === null ? (
            <EmptyState loading={loading} />
          ) : (
            <>
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
            </>
          )}
        </main>
      </div>
    </div>
  );
}
