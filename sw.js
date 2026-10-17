/* Kanifnath ERP service worker
 * - Same-origin GET requests, plus the versioned Firebase JS SDK files on gstatic (cache-first, immutable URLs) so the app shell can start offline.
 * - Firestore / Auth network traffic (googleapis.com) is never touched.
 * - HTML + JS: network-first (so a new deployment is picked up immediately), cache fallback when offline.
 * - CSS / images / manifest: stale-while-revalidate.
 * NOTE: the app's data lives in Firestore, which needs a connection. Offline mode shows the app shell only. */
const VERSION = "kc-erp-v6";
const CORE = [
  "./", "index.html", "login.html", "Billing%20Calculator%20Page.html", "quotation.html", "history.html", "labour-management.html",
  "assets/app.css", "print.css", "js/common.js", "js/data.js", "js/finance.js", "firebase.js", "manifest.json",
  "icon-1922.png", "icon-5122.png",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method === "GET" && url.origin === "https://www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })));
    return;
  }
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  const isCode = req.mode === "navigate" || /\.(html|js)$/.test(url.pathname) || url.pathname.endsWith("/");
  if (isCode) {
    e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))));
    return;
  }
  e.respondWith(caches.match(req).then((cached) => {
    const net = fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; }).catch(() => cached);
    return cached || net;
  }));
});
