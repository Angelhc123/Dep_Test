import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ScanSummary } from "@depscan/core";
import { SEVERITIES, SEVERITY_COLOR, SEVERITY_LABEL } from "../lib/format";

/** Fallas únicas por severidad (barras horizontales, una por nivel). */
export function SeverityChart({ summary }: { summary: ScanSummary }) {
  const data = SEVERITIES.map((s) => ({ key: s, name: SEVERITY_LABEL[s], value: summary.bySeverity[s] }));
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <XAxis
            type="number"
            allowDecimals={false}
            stroke="currentColor"
            className="text-xs text-zinc-400"
          />
          <YAxis
            type="category"
            dataKey="name"
            width={70}
            stroke="currentColor"
            className="text-xs text-zinc-500"
          />
          <Tooltip
            cursor={{ fill: "rgba(120,120,120,0.1)" }}
            formatter={(v) => [v, "Fallas"]}
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key} fill={SEVERITY_COLOR[d.key]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
