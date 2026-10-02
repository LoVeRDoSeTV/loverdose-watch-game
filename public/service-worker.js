const VERSION = 'loverdosetv-v109';
const SHELL_CACHE = `${VERSION}-shell`;
const SHELL = [
  '/pwa-icon-192.webp',
  '/pwa-icon-512.webp',
  '/pwa-icon-maskable-512.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('loverdosetv-') && key !== SHELL_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Le jeu dépend du serveur, de Twitch et de PostgreSQL : on laisse le réseau
// gérer HTML/API/SSE afin de ne jamais afficher de progression périmée.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
  }
});
