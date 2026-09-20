import type {
  DemandFitResult,
  OptimizeRequest,
  OptimizeResponse,
  SimulateRequest,
  SimulateResponse,
} from "./types";

export class ApiError extends Error {}

/** FastAPI errors are {detail: string} (400) or {detail: [{loc, msg}]} (422). */
export function formatApiError(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: unknown[]; msg?: string }) => {
        const where = (d.loc ?? []).filter((p) => p !== "body").join(".");
        return `${where}: ${d.msg ?? "invalid"}`;
      })
      .join("; ");
  }
  return `Request failed (HTTP ${status}).`;
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError("Cannot reach the API. Is the FastAPI service running?");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(formatApiError(res.status, body));
  }
  return res;
}

function post(path: string, payload: unknown): Promise<Response> {
  return request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export const optimize = async (req: OptimizeRequest): Promise<OptimizeResponse> =>
  (await post("/api/v1/optimize", req)).json();

export const simulate = async (req: SimulateRequest): Promise<SimulateResponse> =>
  (await post("/api/v1/simulate", req)).json();

export const fitDemand = async (sales: number[]): Promise<DemandFitResult> =>
  (await post("/api/v1/fit-demand", { sales })).json();

export async function downloadReport(kind: "csv" | "pdf", req: SimulateRequest): Promise<Blob> {
  return (await post(`/api/v1/report/${kind}`, req)).blob();
}

export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch("/health", { signal, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
