import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import type { SeriesPoint } from "@/lib/weather/types";

export function Sparkline({ series, dataKey }: { series: SeriesPoint[]; dataKey: "airTemp" | "windSpeed" }) {
  if (series.length < 2) return null;
  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="var(--color-accent)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
