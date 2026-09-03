import { Wind } from "lucide-react";
import { cardinal, formatClock, hPa } from "@/lib/weather/derive";
import type { SiteWeather } from "@/lib/weather/types";

export function WidgetFace({ site, fetchedAt }: { site: SiteWeather; fetchedAt: number }) {
  const now = site.now;
  return (
    <article className="rounded-xl bg-card p-5 text-foreground shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-widest text-accent">{site.shortName}</p>
          <h2 className="mt-1 text-lg font-medium leading-tight text-balance">{site.name}</h2>
        </div>
        <p className="font-mono text-4xl tabular-nums leading-none tracking-tight">
          {now ? now.airTemp.toFixed(1) : "—"}
          <span className="ml-0.5 text-lg text-muted">°</span>
        </p>
      </div>
      {now ? (
        <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-subtle">Wind</dt>
            <dd className="mt-0.5 font-mono tabular-nums">
              {cardinal(now.windDirection)} {now.windSpeed.toFixed(0)}
            </dd>
          </div>
          <div>
            <dt className="text-subtle">RH</dt>
            <dd className="mt-0.5 font-mono tabular-nums">{now.airHumidity.toFixed(0)}%</dd>
          </div>
          <div>
            <dt className="text-subtle">hPa</dt>
            <dd className="mt-0.5 font-mono tabular-nums">{hPa(now.airPressure).toFixed(0)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-5 text-sm text-muted">Waiting for a sample.</p>
      )}
      <p className="mt-4 flex items-center gap-1.5 text-xs text-subtle">
        <Wind className="size-3" aria-hidden="true" />
        Updated {formatClock(now?.time ?? fetchedAt)} SAST
      </p>
    </article>
  );
}
