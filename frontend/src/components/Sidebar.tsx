import { ChevronDown, FileUp, Play, SlidersHorizontal, Wand2 } from "lucide-react";
import { type DragEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { fitDemand } from "@/lib/api";
import { num, parseSalesCsv } from "@/lib/analysis";
import { DEFAULT_FORM, type FormValues } from "@/lib/form";
import type { DemandFitResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, Button } from "./ui/primitives";

/* --------------------------------------------------------------- inputs */

export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));

  // follow external changes (e.g. parameters imported from a CSV fit)
  useEffect(() => {
    setText((t) => (Number(t) === value ? t : String(value)));
  }, [value]);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[11px] text-slate-600">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={text}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          setText(e.target.value);
          const n = e.target.valueAsNumber;
          if (Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => setText(String(value))}
        className="box-border w-full rounded-[7px] border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-[13px] font-semibold text-slate-900 outline-none transition-colors focus:border-blue-600 focus:bg-white"
      />
    </div>
  );
}

const GROUP_TITLE = "mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className={GROUP_TITLE}>{title}</div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function CollapsibleGroup({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(GROUP_TITLE, "mb-0 flex w-full items-center justify-between hover:text-slate-700")}
      >
        {title}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-2 grid grid-cols-2 gap-2">{children}</div>}
    </div>
  );
}

/* --------------------------------------------------------- CSV dropzone */

export function CsvDropzone({ onApply }: { onApply: (fit: DemandFitResult) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fit, setFit] = useState<DemandFitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setFit(null);
    try {
      setFit(await fitDemand(parseSalesCsv(await file.text())));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not fit the CSV.");
    } finally {
      setBusy(false);
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handle(e.dataTransfer.files[0]);
  };

  return (
    <div className="space-y-2 py-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Historical demand
      </h2>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center text-xs transition-colors",
          dragging ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-slate-50",
        )}
      >
        <FileUp className="h-5 w-5 text-slate-500" aria-hidden />
        <span className="text-slate-600">Drop a CSV of daily sales</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-blue-600 underline-offset-2 hover:underline"
        >
          CSV Talep Yükle
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          aria-label="Upload demand CSV"
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {busy && <p className="text-xs text-slate-500">Fitting distribution…</p>}
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
      {fit && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="flex items-center justify-between">
            <Badge tone={fit.distribution_type === "poisson" ? "sky" : "amber"}>
              {fit.distribution_type === "poisson" ? "Poisson" : "Negative Binomial"}
            </Badge>
            <span className="text-slate-500">n = {fit.n}</span>
          </div>
          <p className="tabular text-slate-600">
            μ = {num(fit.mu)} · σ² = {num(fit.variance)} · D = {num(fit.dispersion_index)}
          </p>
          <Button variant="outline" className="h-8 w-full text-xs" onClick={() => onApply(fit)}>
            <Wand2 className="h-3.5 w-3.5" aria-hidden /> Apply to model
          </Button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- sidebar */

const DISTRIBUTIONS: { value: FormValues["demandType"]; label: string }[] = [
  { value: "poisson", label: "Poisson" },
  { value: "negative_binomial", label: "NegBin" },
];

export function Sidebar({
  form,
  onChange,
  onRun,
  loading,
  errors,
  open,
  lastRun,
}: {
  form: FormValues;
  onChange: (patch: Partial<FormValues>) => void;
  onRun: () => void;
  loading: boolean;
  errors: string[];
  open: boolean;
  lastRun: string;
}) {
  const set = <K extends keyof FormValues>(k: K) => (v: FormValues[K]) => onChange({ [k]: v });
  const nb = form.demandType === "negative_binomial";

  return (
    <aside
      aria-label="Parameter cockpit"
      className={cn(
        "flex-col self-stretch rounded-xl border border-slate-200/80 bg-white shadow-sm",
        open ? "flex" : "hidden lg:flex",
      )}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3.5">
        <SlidersHorizontal className="h-[15px] w-[15px] text-slate-500" aria-hidden />
        <h2 className="text-[13px] font-semibold text-slate-900">Parameter Cockpit</h2>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4 p-4">
        <div>
          <div className={GROUP_TITLE}>Demand Distribution</div>
          <div role="radiogroup" aria-label="Distribution" className="grid grid-cols-2 gap-1.5">
            {DISTRIBUTIONS.map((d) => {
              const on = form.demandType === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange({ demandType: d.value })}
                  className={cn(
                    "rounded-[7px] border py-2.5 text-[12.5px] font-semibold transition-colors",
                    on
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <div className="mt-2 font-mono text-[11px] leading-normal text-slate-500">
            E[D] = {num(form.mu, 2)} &nbsp;·&nbsp; Var[D] = {num(nb ? form.variance : form.mu, 2)}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <NumberField label="Mean μ" value={form.mu} onChange={set("mu")} step={0.5} min={0} />
            {nb && <NumberField label="Variance σ²" value={form.variance} onChange={set("variance")} min={0} />}
          </div>
        </div>

        <Group title="Cost Parameters">
          <NumberField label="K · setup" value={form.setup} onChange={set("setup")} min={0} />
          <NumberField label="c · unit" value={form.unitOrder} onChange={set("unitOrder")} step={0.5} min={0} />
          <NumberField label="h · holding" value={form.holding} onChange={set("holding")} step={0.5} min={0} />
          <NumberField label="p · shortage" value={form.shortage} onChange={set("shortage")} step={0.5} min={0} />
        </Group>

        <Group title="MDP Parameters">
          <NumberField label="γ · discount" value={form.gamma} onChange={set("gamma")} step={0.01} min={0} max={0.995} />
          <NumberField label="L · lead time" value={form.leadTime} onChange={set("leadTime")} min={0} max={30} />
          <NumberField label="B · backlog" value={form.maxBacklog} onChange={set("maxBacklog")} step={5} min={0} />
          <NumberField label="C · capacity" value={form.capacity} onChange={set("capacity")} step={5} min={1} />
        </Group>

        <CollapsibleGroup title="Simulation">
          <NumberField label="T · days" value={form.horizon} onChange={set("horizon")} step={30} min={1} />
          <NumberField label="Replications" value={form.replications} onChange={set("replications")} step={50} min={2} />
          <NumberField label="Seed" value={form.seed} onChange={set("seed")} min={0} />
        </CollapsibleGroup>

        <CsvDropzone
          onApply={(fit) =>
            onChange({
              demandType: fit.distribution_type,
              mu: Number(fit.mu.toFixed(2)),
              ...(fit.distribution_type === "negative_binomial"
                ? { variance: Number(fit.variance.toFixed(2)) }
                : {}),
            })
          }
        />

        <div>
          {errors.length > 0 && (
            <ul role="alert" className="mb-3 space-y-1 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <Button
            variant="primary"
            className="h-11 w-full text-[13px]"
            onClick={onRun}
            loading={loading}
            disabled={errors.length > 0}
          >
            {!loading && <Play className="h-4 w-4" aria-hidden />}
            {loading ? "Solving…" : "Run Optimization & Simulation"}
          </Button>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FORM)}
            className="mt-2 w-full text-center text-xs text-slate-500 hover:text-slate-700"
          >
            Reset to defaults
          </button>
        </div>

        <div className="border-t border-slate-100 pt-3 font-mono text-[10.5px] leading-relaxed text-slate-400">
          solver: value-iteration
          <br />
          states: {form.maxBacklog + form.capacity + 1} · horizon: {form.horizon}d
          <br />
          last run: {lastRun}
        </div>
      </div>
    </aside>
  );
}
