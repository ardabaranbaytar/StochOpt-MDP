import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { num } from "@/lib/analysis";
import { COLORS } from "@/lib/colors";
import type { OptimizeResponse } from "@/lib/types";
import { ChartTooltip } from "./ui/chart-tooltip";

const axisProps = {
  stroke: COLORS.grid,
  tick: { fill: "#94A3B8", fontSize: 11, fontFamily: "IBM Plex Mono, monospace" },
  tickLine: false,
} as const;

const CHIP = "rounded-[7px] border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-700";

export function PolicyTab({ opt, leadTime }: { opt: OptimizeResponse; leadTime: number }) {
  const data = useMemo(
    () => opt.states.map((x, i) => ({ x, value: opt.values[i], order: opt.policy[i] })),
    [opt],
  );
  const [hover, setHover] = useState<number | null>(null);
  const point = hover === null ? null : data[hover];
  const xLabel = leadTime > 0 ? "Inventory position x" : "Inventory level x";

  return (
    <div className="p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">V*(x) and the optimal decision rule</div>
          <div className="mt-0.5 text-[12.5px] text-slate-500">Hover the chart to inspect a state.</div>
        </div>
        <div className="flex items-center gap-3.5 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[2.5px] w-3.5 bg-blue-600" />V*(x)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-blue-200" />
            order qty π*(x)
          </span>
        </div>
      </div>

      <div className="rounded-[10px] border border-slate-100 bg-white p-1.5">
        <div className="h-80" role="img" aria-label="Value function and decision rule chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 16, right: 8, bottom: 8, left: 0 }}
              onMouseMove={(s) => setHover(typeof s?.activeTooltipIndex === "number" ? s.activeTooltipIndex : null)}
              onMouseLeave={() => setHover(null)}
            >
              <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="x"
                interval="preserveStartEnd"
                minTickGap={28}
                label={{ value: xLabel, position: "insideBottom", offset: -2, fill: "#94A3B8", fontSize: 11 }}
                {...axisProps}
              />
              <YAxis yAxisId="v" width={52} tickFormatter={(v: number) => num(v, 0)} {...axisProps} />
              <YAxis yAxisId="q" orientation="right" width={36} allowDecimals={false} {...axisProps} />
              <Tooltip
                cursor={{ stroke: "#CBD5E1" }}
                content={
                  <ChartTooltip
                    labelFormat={(x) => `x = ${x}`}
                    format={(e) => [
                      e.name === "value" ? "V*(x)" : "Order quantity",
                      e.name === "value" ? num(Number(e.value)) : `${e.value} units`,
                    ]}
                  />
                }
              />
              <Bar yAxisId="q" dataKey="order" fill="#BFDBFE" radius={[1, 1, 0, 0]} isAnimationActive={false} />
              {opt.s !== null && (
                <ReferenceLine
                  yAxisId="v"
                  x={opt.s}
                  stroke={COLORS.danger}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: `s = ${opt.s}`, fill: COLORS.danger, fontSize: 12, fontWeight: 600, position: "insideTopRight" }}
                />
              )}
              {opt.S !== null && (
                <ReferenceLine
                  yAxisId="v"
                  x={opt.S}
                  stroke={COLORS.mdp}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: `S = ${opt.S}`, fill: COLORS.mdp, fontSize: 12, fontWeight: 600, position: "insideTopLeft" }}
                />
              )}
              <Line yAxisId="v" type="monotone" name="value" dataKey="value" stroke={COLORS.primary} strokeWidth={2.5} dot={false} animationDuration={700} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2.5">
        <span className={CHIP}>
          {point
            ? `x = ${point.x}   V*(x) = ${num(point.value, 1)}   π*(x) = ${point.order}`
            : "x = —   V*(x) = —   π*(x) = —"}
        </span>
        <span className={CHIP}>rule: order (S − x) if x ≤ s, else 0</span>
        <span className={CHIP}>
          {opt.iterations} iterations · residual {opt.residual.toExponential(1)}
          {opt.is_s_S_optimal ? "" : " · not a pure (s, S) policy"}
        </span>
      </div>
    </div>
  );
}
