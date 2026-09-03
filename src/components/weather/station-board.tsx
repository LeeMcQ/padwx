import { CloudHail, CloudRain, Droplets, Gauge } from "lucide-react";
import { cn } from "@/lib/cn";
import { airDensity, dewpointC, formatStamp, hPa, padGates, type PadGates } from "@/lib/weather/derive";
import type { Gate, SiteWeather } from "@/lib/weather/types";
import { Sparkline } from "./sparkline";
import { WindCompass } from "./wind-compass";

const GATE_LABEL: Record<keyof PadGates, string> = {
  crane: "Crane",
  pour: "Pour",
  align: "Align",
};

export function StationBoard({ site }: { site: SiteWeather }) {
  const now = site.now;
  const gates = now ? padGates(now) : null;
  const dew = now ? dewpointC(now.airTemp, now.airHumidity) : null;
  const rho = now ? airDensity(now.airPressure, now.airTemp) : null;

  return (
    <section className="rounded-xl bg-card p-5 md:p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-widest text-accent">{site.shortName}</p>
          <h2 className="mt-1 text-2xl font-medium leading-tight tracking-tight text-balance">{site.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {site.region} · {site.elevationM} m
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-5xl tabular-nums leading-none tracking-tight md:text-6xl">
            {now ? now.airTemp.toFixed(1) : "—"}
            <span className="text-2xl text-muted">°</span>
          </p>
          {now ? (
            <p className="mt-2 text-xs text-subtle">{formatStamp(now.time)} SAST</p>
          ) : (
            <p className="mt-2 text-xs text-subtle">No sample</p>
          )}
        </div>
      </header>

      {now ? (
        <>
          <div className="mt-6 border-t border-border pt-5">
            <WindCompass deg={now.windDirection} speed={now.windSpeed} />
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric icon={Droplets} label="Humidity" value={`${now.airHumidity.toFixed(0)}%`} />
            <Metric icon={Gauge} label="Pressure" value={`${hPa(now.airPressure).toFixed(0)} hPa`} />
            <Metric icon={CloudRain} label="Rain" value={`${now.rainAccumulation.toFixed(2)} mm`} />
            <Metric icon={CloudHail} label="Hail" value={`${now.hailAccumulation.toFixed(2)}`} />
          </dl>

          <p className="mt-4 text-xs text-subtle">
            Dew point {dew!.toFixed(1)}° · Density {rho!.toFixed(2)} kg/m³
            {now.airTemp - dew! < 2 ? " · Condensation risk" : ""}
          </p>

          {site.series.length > 1 ? (
            <div className="mt-5">
              <div className="flex items-baseline justify-between">
                <p className="text-xs tracking-wide text-subtle">Air temperature, 24 h</p>
                <p className="font-mono text-xs tabular-nums text-muted">
                  {Math.min(...site.series.map((p) => p.airTemp)).toFixed(1)}° –{" "}
                  {Math.max(...site.series.map((p) => p.airTemp)).toFixed(1)}°
                </p>
              </div>
              <Sparkline series={site.series} dataKey="airTemp" />
            </div>
          ) : null}

          {gates ? (
            <ul className="mt-5 flex flex-wrap gap-2">
              {(Object.keys(GATE_LABEL) as (keyof PadGates)[]).map((key) => (
                <GateChip key={key} label={GATE_LABEL[key]} gate={gates[key]} />
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="mt-6 text-sm text-muted">This pad has not reported yet.</p>
      )}
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Droplets;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-background px-3 py-3">
      <dt className="flex items-center gap-1.5 text-xs text-subtle">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function GateChip({ label, gate }: { label: string; gate: Gate }) {
  return (
    <li
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium",
        gate === "go" && "bg-ok/15 text-ok",
        gate === "caution" && "bg-warn/15 text-warn",
        gate === "hold" && "bg-bad/15 text-bad",
      )}
    >
      {label} {gate}
    </li>
  );
}
