import type { ReactNode } from "react";

interface Entry {
  name?: string | number;
  value?: number | string | readonly (number | string)[];
  color?: string;
  stroke?: string;
  fill?: string;
}

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: readonly Entry[];
  /** Header shown above the series rows. */
  labelFormat?: (label: string | number) => ReactNode;
  /** Per-series override of the displayed name and value. */
  format?: (entry: Entry) => [ReactNode, ReactNode];
}

/** Dark-glass Recharts tooltip with a coloured marker per series. */
export function ChartTooltip({ active, label, payload, labelFormat, format }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 shadow-lg">
      {label !== undefined && (
        <p className="mb-2 font-medium text-slate-600">{labelFormat ? labelFormat(label) : label}</p>
      )}
      <ul className="space-y-1.5">
        {payload.map((e, i) => {
          const [name, value] = format ? format(e) : [e.name, String(e.value)];
          return (
            <li key={`${e.name}-${i}`} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: e.color ?? e.stroke ?? e.fill }}
                aria-hidden
              />
              <span className="text-slate-500">{name}</span>
              <span className="ml-auto pl-4 font-mono font-semibold text-slate-900">{value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
