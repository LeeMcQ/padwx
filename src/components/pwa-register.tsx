import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const periodic = (
          reg as ServiceWorkerRegistration & {
            periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
          }
        ).periodicSync;
        if (periodic && "permissions" in navigator) {
          const status = await navigator.permissions.query({
            name: "periodic-background-sync" as PermissionName,
          });
          if (status.state === "granted") {
            await periodic.register("weather-hourly", { minInterval: 60 * 60 * 1000 });
          }
        }
      } catch {
        // Install still works without background sync.
      }
    };
    void register();
  }, []);
  return null;
}
