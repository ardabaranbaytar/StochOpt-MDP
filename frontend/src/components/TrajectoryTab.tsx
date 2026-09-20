import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { COLORS, tooltipStyle } from "@/lib/colors";
import type { OptimizeResponse, Trajectory } from "@/lib/types";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/primitives";

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

/** Order marker with a soft emerald glow. */
function GlowDot({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill={COLORS.mdp} opacity={0.18} />
      <circle cx={cx} cy={cy} r={5} fill={COLORS.mdp} opacity={0.35} />
      <circle cx={cx} cy={cy} r={3} fill="#6ee7b7" stroke={COLORS.mdp} strokeWidth={1} />
    </g>
  );
}

const axisProps = {
  stroke: COLORS.axis,
  tick: { fill: COLORS.axis, fontSize: 11 },
  tickLine: false,
} as const;

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

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Monte Carlo trajectory · first {data.length} days</CardTitle>
          <div className="flex gap-2">
            <Badge tone="emerald" className="tabular">
              {orders.length} orders
            </Badge>
            {leadTime > 0 && <Badge tone="amber">L = {leadTime}</Badge>}
          </div>
        </div>
        <CardDescription>
          One replication of the MDP policy. Net inventory dips below zero are backlog; glowing
          markers show the inventory position right after an order (it lands on S).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[420px]" role="img" aria-label="Inventory trajectory chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
              <XAxis dataKey="day" type="number" domain={[1, "dataMax"]} label={{ value: "Day", position: "insideBottom", offset: -2, fill: COLORS.axis, fontSize: 11 }} {...axisProps} />
              <YAxis width={48} domain={[Math.floor(lo * 1.1), Math.ceil(hi * 1.1)]} {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => `Day ${d}`} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
              {lo < 0 && (
                <ReferenceArea y1={Math.floor(lo * 1.1)} y2={0} fill={COLORS.danger} fillOpacity={0.06} ifOverflow="hidden" />
              )}
              <ReferenceLine y={0} stroke={COLORS.danger} strokeOpacity={0.5} />
              {opt.s !== null && (
                <ReferenceLine
                  y={opt.s}
                  stroke={COLORS.danger}
                  strokeDasharray="6 4"
                  label={{ value: `s = ${opt.s}`, fill: COLORS.danger, fontSize: 11, position: "insideTopRight" }}
                />
              )}
              {opt.S !== null && (
                <ReferenceLine
                  y={opt.S}
                  stroke={COLORS.mdp}
                  strokeDasharray="6 4"
                  label={{ value: `S = ${opt.S}`, fill: COLORS.mdp, fontSize: 11, position: "insideTopRight" }}
                />
              )}
              <Line name="Net inventory (end of day)" type="stepAfter" dataKey="inventory" stroke={COLORS.eoq} strokeWidth={2} dot={false} isAnimationActive={false} />
              {leadTime > 0 && (
                <Line name="Inventory position" type="stepAfter" dataKey="position" stroke={COLORS.indigo} strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
              )}
              <Scatter name="Order placed" data={orders} dataKey="order" fill={COLORS.mdp} shape={GlowDot} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
