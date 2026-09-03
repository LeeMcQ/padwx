import { cn } from "@/lib/cn";
import type { SiteChoice } from "@/lib/weather/types";

const OPTIONS: { id: SiteChoice; label: string }[] = [
  { id: "hbk", label: "HBK" },
  { id: "mtj", label: "MTJ" },
  { id: "both", label: "Both" },
];

export function SiteToggle({
  value,
  onChange,
}: {
  value: SiteChoice;
  onChange: (next: SiteChoice) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Station"
      className="grid grid-cols-3 rounded-md bg-card p-1"
    >
      {OPTIONS.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.id)}
            className={cn(
              "h-11 rounded-sm text-sm font-medium tracking-wide transition-colors duration-150 ease-out",
              selected ? "bg-accent text-accent-fg" : "text-muted hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
