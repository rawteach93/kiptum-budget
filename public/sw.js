/* App-shell cache. Never caches /api — your data always comes from the server. */
var CACHE = 'kb-shell-v2';
var SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.json', '/icon.svg'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })); self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }));
  self.clients.claim();
});
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.indexOf('/api/') === 0) return;
  // network-first so updates land immediately; cache as offline fallback
  e.respondWith(fetch(e.request).then(function (r) {
    var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return r;
  }).catch(function () { return caches.match(e.request).then(function (m) { return m || caches.match('/'); }); }));
});
self.addEventListener('notificationclick', function (e) { e.notification.close(); e.waitUntil(self.clients.openWindow('/')); });
