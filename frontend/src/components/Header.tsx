import { BookOpen, LineChart, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { checkHealth } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/primitives";

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
    checking: { dot: "bg-zinc-500", text: "Checking…", tone: "zinc" as const },
    online: { dot: "bg-emerald-400", text: "API online", tone: "emerald" as const },
    offline: { dot: "bg-rose-500", text: "API offline", tone: "rose" as const },
  }[status];
  return (
    <Badge tone={map.tone} role="status" aria-label={`FastAPI status: ${map.text}`}>
      <span className="relative flex h-2 w-2">
        {status === "online" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", map.dot)} />
      </span>
      {map.text}
    </Badge>
  );
}

export function Header({
  status,
  onToggleSidebar,
}: {
  status: ApiStatus;
  onToggleSidebar: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-[#090A0F]/80 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle control panel"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-zinc-950">
            <LineChart className="h-4.5 w-4.5" aria-hidden />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-zinc-100">StochOpt Enterprise</h1>
              <Badge tone="emerald" className="tabular">
                v1.1.0
              </Badge>
            </div>
            <p className="hidden text-[11px] text-zinc-500 sm:block">Operations Research Suite</p>
          </div>
        </div>
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Resources">
          <StatusIndicator status={status} />
          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 sm:inline-flex"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden /> API Docs
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            <GithubMark className="h-3.5 w-3.5" /> <span className="hidden sm:inline">GitHub</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
