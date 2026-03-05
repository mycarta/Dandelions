const CACHE = 'dandelions-v3';

const ASSETS = [
  '.',
  'index.html',
  'game.js',
  'style.css',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
];

// Install: pre-cache all game assets.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  // Activate immediately instead of waiting for old tabs to close.
  self.skipWaiting();
});

// Activate: delete any old cache versions.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first, fall back to network.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
