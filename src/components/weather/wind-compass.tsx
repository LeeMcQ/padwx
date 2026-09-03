import { cardinal } from "@/lib/weather/derive";

export function WindCompass({ deg, speed }: { deg: number; speed: number }) {
  const label = cardinal(deg);
  return (
    <div className="flex items-center gap-4">
      <div className="relative size-16 shrink-0">
        <svg viewBox="0 0 64 64" className="size-16 text-subtle" aria-hidden="true">
          <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="1" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const rad = ((a - 90) * Math.PI) / 180;
            const x1 = 32 + Math.cos(rad) * 24;
            const y1 = 32 + Math.sin(rad) * 24;
            const x2 = 32 + Math.cos(rad) * 28;
            const y2 = 32 + Math.sin(rad) * 28;
            return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" />;
          })}
          <g
            className="text-accent origin-center"
            style={{ transform: `rotate(${deg}deg)`, transformOrigin: "32px 32px" }}
          >
            <polygon points="32,10 36,32 28,32" fill="currentColor" />
            <polygon points="32,54 36,32 28,32" fill="currentColor" opacity="0.35" />
          </g>
        </svg>
      </div>
      <div className="min-w-0">
        <p className="font-mono text-lg tabular-nums leading-tight text-foreground">
          {speed.toFixed(1)} <span className="text-sm text-muted">km/h</span>
        </p>
        <p className="text-sm text-muted">
          {label} · {Math.round(deg)}°
        </p>
      </div>
    </div>
  );
}
