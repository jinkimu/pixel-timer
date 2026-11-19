const CACHE = "pixel-timer-v2";
const FILES = [
  "./", "index.html", "style.css", "app.js", "manifest.json",
  "fonts/dotgothic16-latin-400-normal.woff2", "fonts/dotgothic16-japanese-400-normal.woff2",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// ネットワーク優先、失敗時はキャッシュ(更新が反映されやすい)
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
  );
});
