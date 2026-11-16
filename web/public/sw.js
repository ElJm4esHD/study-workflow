// Service worker de GitHub Pages: la app abre sin conexión. Red primero para la página (así una versión nueva se ve al recargar) y caché para los archivos con hash.
const CACHE = 'sw-pages-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // Google y Drive van directo a la red
  const store = (res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };
  if (url.pathname.endsWith('/privacidad.html')) return; // página aparte: siempre de la red
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); if (r.ok) caches.open(CACHE).then((c) => c.put('./index.html', copy)); return r; })
      .catch(() => caches.match('./index.html')));
  } else {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(store)));
  }
});
