// Service worker del POS: guarda la app para que abra sin internet en la feria.
// La página va primero a la red (así siempre llega la última versión) y cae al
// caché si no hay conexión. Supabase no pasa por aquí: las ventas sin conexión
// ya las guarda la propia página en localStorage.

const CACHE = 'pos-v2';
const SHELL = [
  '/pos/',
  '/pos/manifest.json',
  '/pos/vendor/supabase.js',
  '/pos/icon-192.png',
  '/pos/icon-512.png',
  '/favicon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'no-cache' })))).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      // Una navegación no admite RequestInit; el HTML ya llega con no-cache.
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then(c => c.put('/pos/', copia));
          }
          return res;
        })
        .catch(() => caches.match('/pos/')),
    );
    return;
  }

  if (!url.pathname.startsWith('/pos/') && url.pathname !== '/favicon.svg') return;

  // Archivos fijos: se sirven del caché y se refrescan por detrás. no-cache
  // salta la caché de un año que Firebase pone a todo .js/.png.
  event.respondWith(
    caches.match(req).then(cacheado => {
      const red = fetch(req, { cache: 'no-cache' })
        .then(res => {
          if (res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then(c => c.put(req, copia));
          }
          return res;
        })
        .catch(() => cacheado);
      return cacheado || red;
    }),
  );
});
