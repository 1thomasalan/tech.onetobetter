/* The Tech Brief service worker (mirror only). Keeps today's issue readable offline. No push, no notifications.
   Version stamp is filled in by library/publish_github.py on every publish, so each daily refresh replaces the cache. */
var V = "tb-202611140422-8b3172a3";
var CORE = ["/", "/index.html", "/manifest.webmanifest", "/hark.css", "/hark.js", "/hark-charts.css", "/hark-charts.js", "/hark-hero.css",
  "/chart.js", "/datalabels.js", "/otb-visuals.css", "/otb-visuals.js", "/otb-visuals2.js", "/otb-visuals3.js", "/otb-map.js", "/otb-sections.js",
  "/otb-world.js", "/page-flip.browser.js", "/otb-next.css", "/otb-share.js", "/otb-pillars.js", "/otb-app.js", "/otb-pwa.js",
  "/otb-logo-160.png", "/otb-logo-dark.png", "/icons/icon-192.png", "/icons/icon-512.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(V).then(function (c) {
    return Promise.all(CORE.map(function (u) { return c.add(new Request(u, { cache: "reload" })).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf("tb-") === 0 && k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function put(req, res) {
  if (res && res.ok && res.type === "basic") { var copy = res.clone(); caches.open(V).then(function (c) { c.put(req, copy); }); }
  return res;
}
self.addEventListener("fetch", function (e) {
  var req = e.request, url;
  if (req.method !== "GET") return;
  try { url = new URL(req.url); } catch (x) { return; }
  if (url.origin !== self.location.origin) return;            // Sheet, fonts, favicons, analytics: straight to the network
  if (/\.mp3$/i.test(url.pathname) || req.headers.get("range")) return; // podcast streams from the network
  if (req.mode === "navigate") {
    // Pages: network first (fresh brief), cached copy when offline
    e.respondWith(fetch(req).then(function (res) { return put(url.pathname === "/" || url.pathname === "/index.html" ? new Request("/") : req, res); }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match("/"); });
    }));
    return;
  }
  // Files: cached copy at once, refreshed in the background
  e.respondWith(caches.match(req).then(function (hit) {
    var net = fetch(req).then(function (res) { return put(req, res); }).catch(function () { return hit; });
    return hit || net;
  }));
});
