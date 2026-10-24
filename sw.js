// Road to C1 : garde l'app sur le téléphone pour l'ouvrir même sans réseau.
const VERSION = "c1-v2";
const SHELL = ["./", "index.html", "sync.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url);
  // Seuls l'app, la bibliothèque Firebase et les polices sont gardées. La base et GitHub passent toujours par le réseau.
  if (![location.host, "www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"].includes(u.host)) return;
  const isPage = r.mode === "navigate" || (u.origin === location.origin && /\.(html|js)$|\/$/.test(u.pathname));
  if (isPage) {
    // Réseau d'abord pour recevoir les mises à jour, sinon la copie gardée.
    e.respondWith(fetch(r).then((res) => { const cp = res.clone(); caches.open(VERSION).then((c) => c.put(r, cp)); return res; })
      .catch(() => caches.match(r).then((m) => m || caches.match("index.html"))));
  } else {
    // Polices, icônes, bibliothèque Firebase : copie gardée d'abord, mise à jour en arrière-plan.
    e.respondWith(caches.match(r).then((m) => { const net = fetch(r).then((res) => { const cp = res.clone(); caches.open(VERSION).then((c) => c.put(r, cp)); return res; }).catch(() => m); return m || net; }));
  }
});
