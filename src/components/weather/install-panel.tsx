import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SiteId } from "@/lib/weather/types";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPanel({ site }: { site: SiteId }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [android, setAndroid] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setAndroid(/Android/i.test(navigator.userAgent));
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const installApp = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 size-5 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-medium">Android app and pad widget</h2>
          <p className="mt-1 text-sm leading-normal text-pretty text-muted">
            Install PadWx on the home screen. Open a glance for {site.toUpperCase()} and pin that
            page as a second icon — it is the live widget, refreshed every hour.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {deferred && !standalone ? (
          <Button type="button" onClick={() => void installApp()}>
            <Download className="size-4" aria-hidden="true" />
            Install PadWx
          </Button>
        ) : null}
        <Link
          to="/widget"
          search={{ site }}
          className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
        >
          Open {site.toUpperCase()} widget
        </Link>
        <a
          href="/padwx-github.zip"
          download="padwx-github.zip"
          className="inline-flex h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-medium"
        >
          Download GitHub pack
        </a>
      </div>

      <ol className="mt-4 space-y-2 text-sm text-muted">
        <li>
          <span className="font-medium text-foreground">1. App — </span>
          {android
            ? "Chrome menu, then Install app or Add to Home screen."
            : "Use the browser install prompt, or Chrome on an Android phone."}
        </li>
        <li>
          <span className="font-medium text-foreground">2. Widget — </span>
          Open the glance, then Add to Home screen. That icon launches only the selected pad.
        </li>
        <li>
          <span className="font-medium text-foreground">3. Hourly — </span>
          Readings refresh automatically every hour, and again whenever you open the app.
        </li>
      </ol>
    </section>
  );
}
