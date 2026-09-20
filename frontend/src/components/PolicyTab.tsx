import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { num } from "@/lib/analysis";
import { COLORS, tooltipStyle } from "@/lib/colors";
import type { OptimizeResponse } from "@/lib/types";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/primitives";

function Thresholds({ s, S }: { s: number | null; S: number | null }) {
  return (
    <>
      {s !== null && (
        <ReferenceLine
          x={s}
          stroke={COLORS.threshold}
          strokeDasharray="4 4"
          label={{ value: `s = ${s}`, fill: COLORS.threshold, fontSize: 11, position: "insideTopRight" }}
        />
      )}
      {S !== null && (
        <ReferenceLine
          x={S}
          stroke={COLORS.mdp}
          strokeDasharray="4 4"
          label={{ value: `S = ${S}`, fill: COLORS.mdp, fontSize: 11, position: "insideTopLeft" }}
        />
      )}
    </>
  );
}

const axisProps = {
  stroke: COLORS.axis,
  tick: { fill: COLORS.axis, fontSize: 11 },
  tickLine: false,
} as const;

export function PolicyTab({ opt, leadTime }: { opt: OptimizeResponse; leadTime: number }) {
  const data = useMemo(
    () => opt.states.map((x, i) => ({ x, value: opt.values[i], order: opt.policy[i] })),
    [opt],
  );
  const xLabel = leadTime > 0 ? "Inventory position x" : "Inventory level x";

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Value function V*(x)</CardTitle>
            <Badge tone="zinc" className="tabular">
              {opt.iterations} iterations · residual {opt.residual.toExponential(1)}
            </Badge>
          </div>
          <CardDescription>Optimal expected discounted cost from each state.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80" role="img" aria-label="Value function chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
                <XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} label={{ value: xLabel, position: "insideBottom", offset: -2, fill: COLORS.axis, fontSize: 11 }} {...axisProps} />
                <YAxis width={56} tickFormatter={(v: number) => num(v, 0)} {...axisProps} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [num(Number(v)), "V*(x)"]}
                  labelFormatter={(x) => `x = ${x}`}
                />
                <Thresholds s={opt.s} S={opt.S} />
                <Line type="monotone" dataKey="value" stroke={COLORS.eoq} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Decision rule π*(x)</CardTitle>
            <Badge tone={opt.is_s_S_optimal ? "emerald" : "rose"}>
              {opt.is_s_S_optimal ? "Pure (s, S) structure" : "Not a pure (s, S) policy"}
            </Badge>
          </div>
          <CardDescription>
            Units to order in each state: order up to S whenever x ≤ s.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80" role="img" aria-label="Decision rule chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                <defs>
                  <linearGradient id="orderFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.mdp} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={COLORS.mdp} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
                <XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} label={{ value: xLabel, position: "insideBottom", offset: -2, fill: COLORS.axis, fontSize: 11 }} {...axisProps} />
                <YAxis width={56} allowDecimals={false} {...axisProps} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [`${v} units`, "Order quantity"]}
                  labelFormatter={(x) => `x = ${x}`}
                />
                <Thresholds s={opt.s} S={opt.S} />
                <Area type="stepAfter" dataKey="order" stroke={COLORS.mdp} strokeWidth={2} fill="url(#orderFill)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
