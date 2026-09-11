const CACHE = "padwx-mtj-v1";
const ASSETS = ["./", "./index.html", "./widget.html", "./css/padwx.css", "./js/padwx.js", "./favicon.svg", "./manifest.webmanifest", "./weather.json"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.endsWith("weather.json")) {
    e.respondWith(fetch(e.request).catch(() => caches.match("./weather.json")));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
