import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { num } from "@/lib/analysis";
import { COLORS } from "@/lib/colors";
import type { OptimizeResponse, Trajectory } from "@/lib/types";
import { ChartTooltip } from "./ui/chart-tooltip";

interface Point {
  day: number;
  inventory: number;
  position: number;
  order: number | null; // inventory position after ordering, only on order days
}

export function toPoints(t: Trajectory): Point[] {
  return t.days.map((day, i) => ({
    day,
    inventory: t.inventory[i],
    position: t.position[i],
    order: t.orders[i] > 0 ? t.position[i] : null,
  }));
}

/** Order marker: white dot with a cobalt ring. */
function OrderDot({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx === undefined || cy === undefined) return null;
  return <circle cx={cx} cy={cy} r={3.5} fill="#fff" stroke={COLORS.primary} strokeWidth={1.5} />;
}

const axisProps = {
  stroke: COLORS.grid,
  tick: { fill: "#94A3B8", fontSize: 11, fontFamily: "IBM Plex Mono, monospace" },
  tickLine: false,
} as const;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-slate-200 px-3.5 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1.5 font-mono text-[19px] font-bold text-slate-900">{value}</div>
    </div>
  );
}

export function TrajectoryTab({
  trajectory,
  opt,
  leadTime,
}: {
  trajectory: Trajectory;
  opt: OptimizeResponse;
  leadTime: number;
}) {
  const data = useMemo(() => toPoints(trajectory), [trajectory]);
  const orders = data.filter((p) => p.order !== null);
  const lo = Math.min(0, ...data.map((p) => p.inventory), opt.s ?? 0);
  const hi = Math.max(...data.map((p) => p.position), opt.S ?? 0);
  const stockoutDays = data.filter((p) => p.inventory < 0).length;
  const peak = Math.max(...data.map((p) => p.inventory));

  return (
    <div className="p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Inventory trajectory · {data.length} days</div>
          <div className="mt-0.5 text-[12.5px] text-slate-500">
            Single Monte Carlo path of the net inventory under the computed policy. Below zero is backlog.
          </div>
        </div>
        <div className="flex items-center gap-3.5 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[2.5px] w-3.5 bg-blue-600" />x<sub>t</sub>
          </span>
          {leadTime > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0 w-3.5 border-t-2 border-dashed border-slate-400" />
              position
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3.5 bg-rose-600" />s
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3.5 bg-emerald-600" />S
          </span>
        </div>
      </div>

      <div className="rounded-[10px] border border-slate-100 bg-white p-1.5">
        <div className="h-[340px]" role="img" aria-label="Inventory trajectory chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" type="number" domain={[1, "dataMax"]} tickFormatter={(d: number) => `d${d}`} {...axisProps} />
              <YAxis width={48} domain={[Math.floor(lo * 1.1), Math.ceil(hi * 1.1)]} {...axisProps} />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormat={(d) => `Day ${d}`}
                    format={(e) => [e.name, num(Number(e.value), 0)]}
                  />
                }
              />
              {lo < 0 && (
                <ReferenceArea y1={Math.floor(lo * 1.1)} y2={0} fill="#FEF2F2" fillOpacity={1} ifOverflow="hidden" />
              )}
              <ReferenceLine y={0} stroke="#CBD5E1" />
              {opt.s !== null && (
                <ReferenceLine
                  y={opt.s}
                  stroke={COLORS.danger}
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  label={{ value: `s = ${opt.s}`, fill: COLORS.danger, fontSize: 12, fontWeight: 600, position: "insideTopRight" }}
                />
              )}
              {opt.S !== null && (
                <ReferenceLine
                  y={opt.S}
                  stroke={COLORS.mdp}
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  label={{ value: `S = ${opt.S}`, fill: COLORS.mdp, fontSize: 12, fontWeight: 600, position: "insideTopRight" }}
                />
              )}
              <Area name="Net inventory (end of day)" type="linear" dataKey="inventory" stroke={COLORS.primary} strokeWidth={2} fill={COLORS.primary} fillOpacity={0.07} dot={false} animationDuration={700} />
              {leadTime > 0 && (
                <Line name="Inventory position" type="stepAfter" dataKey="position" stroke={COLORS.baseline} strokeWidth={1.5} strokeDasharray="3 3" dot={false} animationDuration={700} />
              )}
              <Scatter name="Order placed" data={orders} dataKey="order" fill={COLORS.primary} shape={OrderDot} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-3.5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
        <Stat label="Replenishments" value={String(orders.length)} />
        <Stat label="Stockout days" value={String(stockoutDays)} />
        <Stat label="Peak on-hand" value={String(peak)} />
        <Stat label="Avg cycle length" value={orders.length ? `${num(data.length / orders.length, 1)} d` : "—"} />
      </div>
    </div>
  );
}
