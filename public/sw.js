const CACHE = "padwx-v1";
const WEATHER_URL = "/api/weather";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline");
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === WEATHER_URL) {
    event.respondWith(networkFirst(event.request));
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "weather-hourly") {
    event.waitUntil(
      fetch(WEATHER_URL)
        .then(async (response) => {
          if (!response.ok) return;
          const cache = await caches.open(CACHE);
          await cache.put(WEATHER_URL, response.clone());
        })
        .catch(() => undefined),
    );
  }
});
