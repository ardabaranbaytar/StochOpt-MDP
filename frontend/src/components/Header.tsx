import { BookOpen, Menu, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { checkHealth } from "@/lib/api";
import { cn } from "@/lib/utils";

const GITHUB_URL = "https://github.com/ardabaranbaytar/StochOpt-MDP";
const POLL_MS = 15_000;

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export type ApiStatus = "checking" | "online" | "offline";

export function useApiStatus(pollMs = POLL_MS): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>("checking");
  useEffect(() => {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const ok = await checkHealth(ctrl.signal);
      if (ctrl.signal.aborted) return;
      setStatus(ok ? "online" : "offline");
      timer = setTimeout(tick, pollMs);
    };
    void tick();
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [pollMs]);
  return status;
}

export function StatusIndicator({ status }: { status: ApiStatus }) {
  const map = {
    checking: { dot: "bg-slate-400", text: "Checking…", pill: "border-slate-200 bg-slate-50 text-slate-600" },
    online: { dot: "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]", text: "API online", pill: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    offline: { dot: "bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.18)]", text: "API offline", pill: "border-rose-200 bg-rose-50 text-rose-700" },
  }[status];
  return (
    <span
      role="status"
      aria-label={`FastAPI status: ${map.text}`}
      className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold", map.pill)}
    >
      <span className={cn("h-[7px] w-[7px] rounded-full", map.dot)} />
      {map.text}
    </span>
  );
}

export function Header({
  status,
  onToggleSidebar,
}: {
  status: ApiStatus;
  onToggleSidebar: () => void;
}) {
  const link = "inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:text-blue-600";
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-[68px] max-w-[1560px] items-center gap-4 px-4 lg:px-6">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle control panel"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-[0_2px_10px_rgba(37,99,235,0.35)]">
            <Package className="h-4 w-4" aria-hidden />
          </div>
          <h1 className="text-base font-bold tracking-tight text-slate-900">StochOpt Enterprise</h1>
          <span className="rounded-[5px] border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
            v1.1.0
          </span>
        </div>
        <StatusIndicator status={status} />
        <p className="hidden text-[11px] text-slate-500 md:block">Operations Research Suite</p>
        <div className="flex-1" />
        <nav className="flex items-center gap-5" aria-label="Resources">
          <a href="/docs" target="_blank" rel="noreferrer" className={cn(link, "hidden sm:inline-flex")}>
            <BookOpen className="h-[15px] w-[15px]" aria-hidden /> Docs
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={link}>
            <GithubMark className="h-[15px] w-[15px]" /> GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
