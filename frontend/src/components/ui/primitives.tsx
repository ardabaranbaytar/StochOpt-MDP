import { Loader2 } from "lucide-react";
import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ Card */

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/80 bg-white shadow-sm transition-[box-shadow,border-color] duration-150 hover:border-slate-300 hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold text-slate-900", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[12.5px] text-slate-500", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-2", className)} {...props} />;
}

/* ----------------------------------------------------------------- Badge */

export type Tone = "emerald" | "amber" | "sky" | "indigo" | "rose" | "zinc";

const TONES: Record<Tone, string> = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  indigo: "border-blue-200 bg-blue-50 text-blue-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  zinc: "border-slate-300 bg-slate-100 text-slate-600",
};

export function Badge({
  tone = "zinc",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

/* ---------------------------------------------------------------- Button */

type ButtonVariant = "primary" | "outline" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white shadow-sm hover:bg-blue-700 font-semibold",
  outline: "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900",
  ghost: "text-slate-600 hover:bg-slate-100",
};

export function Button({
  variant = "outline",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      className={cn(
        "relative inline-flex h-9 items-center justify-center gap-2 overflow-hidden rounded-lg px-4 text-sm transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
      {loading && variant === "primary" && (
        <span aria-hidden className="loading-bar pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-white/30" />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ Tabs */

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = items.findIndex((t) => t.id === value);
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const next = items[(i + step + items.length) % items.length];
    onChange(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div role="tablist" onKeyDown={onKeyDown} className="flex flex-wrap items-center gap-2">
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active}
            aria-controls={`panel-${t.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              "inline-flex items-center gap-2 whitespace-nowrap rounded-lg border px-4 py-2 text-[13.5px] font-semibold transition-colors",
              active
                ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  id,
  active,
  children,
}: {
  id: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={!active}>
      {active ? children : null}
    </div>
  );
}
