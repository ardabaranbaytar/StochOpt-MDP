import { ChevronDown, FileUp, Play, Wand2 } from "lucide-react";
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
  hint,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  hint?: string;
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
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-baseline justify-between text-xs text-zinc-400">
        <span>{label}</span>
        {hint && <span className="text-[10px] text-zinc-600">{hint}</span>}
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
        className="tabular h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
      />
    </div>
  );
}

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-zinc-800/80 py-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
      >
        {title}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-2 grid grid-cols-2 gap-3">{children}</div>}
    </section>
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
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
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
          dragging ? "border-emerald-400 bg-emerald-500/5" : "border-zinc-700 bg-zinc-950/40",
        )}
      >
        <FileUp className="h-5 w-5 text-zinc-500" aria-hidden />
        <span className="text-zinc-300">Drop a CSV of daily sales</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-emerald-400 underline-offset-2 hover:underline"
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
      {busy && <p className="text-xs text-zinc-400">Fitting distribution…</p>}
      {error && (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      )}
      {fit && (
        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-xs">
          <div className="flex items-center justify-between">
            <Badge tone={fit.distribution_type === "poisson" ? "sky" : "amber"}>
              {fit.distribution_type === "poisson" ? "Poisson" : "Negative Binomial"}
            </Badge>
            <span className="text-zinc-500">n = {fit.n}</span>
          </div>
          <p className="tabular text-zinc-300">
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

export function Sidebar({
  form,
  onChange,
  onRun,
  loading,
  errors,
  open,
}: {
  form: FormValues;
  onChange: (patch: Partial<FormValues>) => void;
  onRun: () => void;
  loading: boolean;
  errors: string[];
  open: boolean;
}) {
  const set = <K extends keyof FormValues>(k: K) => (v: FormValues[K]) => onChange({ [k]: v });
  const nb = form.demandType === "negative_binomial";

  return (
    <aside
      aria-label="Control panel"
      className={cn(
        "w-full shrink-0 border-zinc-800 bg-[#12151E]/70 backdrop-blur-md lg:sticky lg:top-14 lg:block lg:h-[calc(100vh-3.5rem)] lg:w-80 lg:overflow-y-auto lg:border-r",
        open ? "block border-b" : "hidden",
      )}
    >
      <div className="p-4">
        <Section title="Demand">
          <div className="col-span-2 space-y-1">
            <label htmlFor="demand-type" className="text-xs text-zinc-400">
              Distribution
            </label>
            <select
              id="demand-type"
              value={form.demandType}
              onChange={(e) => onChange({ demandType: e.target.value as FormValues["demandType"] })}
              className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500/60"
            >
              <option value="poisson">Poisson</option>
              <option value="negative_binomial">Negative Binomial</option>
            </select>
          </div>
          <NumberField label="Mean μ" value={form.mu} onChange={set("mu")} step={0.5} min={0} />
          {nb && (
            <NumberField
              label="Variance σ²"
              hint="> μ"
              value={form.variance}
              onChange={set("variance")}
              step={1}
              min={0}
            />
          )}
        </Section>

        <Section title="Costs">
          <NumberField label="K — setup" value={form.setup} onChange={set("setup")} min={0} />
          <NumberField
            label="c — unit order"
            value={form.unitOrder}
            onChange={set("unitOrder")}
            step={0.5}
            min={0}
          />
          <NumberField
            label="h — holding"
            value={form.holding}
            onChange={set("holding")}
            step={0.5}
            min={0}
          />
          <NumberField
            label="p — shortage"
            value={form.shortage}
            onChange={set("shortage")}
            step={0.5}
            min={0}
          />
        </Section>

        <Section title="MDP parameters">
          <NumberField
            label="γ — discount"
            value={form.gamma}
            onChange={set("gamma")}
            step={0.005}
            min={0}
            max={0.995}
          />
          <NumberField
            label="L — lead time"
            hint="days"
            value={form.leadTime}
            onChange={set("leadTime")}
            min={0}
            max={30}
          />
          <NumberField label="B — max backlog" value={form.maxBacklog} onChange={set("maxBacklog")} step={5} min={0} />
          <NumberField label="C — capacity" value={form.capacity} onChange={set("capacity")} step={5} min={1} />
        </Section>

        <Section title="Simulation" defaultOpen={false}>
          <NumberField label="T — days" value={form.horizon} onChange={set("horizon")} step={30} min={1} />
          <NumberField
            label="Replications"
            value={form.replications}
            onChange={set("replications")}
            step={50}
            min={2}
          />
          <NumberField label="Seed" value={form.seed} onChange={set("seed")} min={0} />
        </Section>

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

        {errors.length > 0 && (
          <ul role="alert" className="mb-3 space-y-1 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-300">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <Button
          variant="primary"
          className="h-10 w-full"
          onClick={onRun}
          loading={loading}
          disabled={errors.length > 0}
        >
          {!loading && <Play className="h-4 w-4" aria-hidden />}
          {loading ? "Optimizing…" : "Run Optimization & Simulation"}
        </Button>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_FORM)}
          className="mt-2 w-full text-center text-xs text-zinc-500 hover:text-zinc-300"
        >
          Reset to defaults
        </button>
      </div>
    </aside>
  );
}
