// ── Service worker : rend l'app installable et utilisable hors ligne ──
//
// Stratégie "réseau d'abord" : avec du réseau, on sert toujours la
// version la plus récente (et on met la copie en cache au passage) ;
// sans réseau, on sert la copie en cache. Les requêtes vers Supabase
// (données, photos, connexion) ne sont jamais mises en cache.

const CACHE = 'garage-rogue-v8';

// L'interface de l'application, mise en cache dès l'installation
const PRECACHE = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './js/config.js',
  './js/constants.js',
  './js/db.js',
  './js/ui.js',
  './js/auth.js',
  './js/app.js',
  './js/update.js',
  './js/components/nav.js',
  './js/views/home.js',
  './js/views/vehicles.js',
  './js/views/vehicle.js',
  './js/views/workorder.js',
  './js/views/activity.js',
  './js/views/planning.js',
  './js/views/dashboard.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const cacheable =
    url.origin === location.origin ||           // fichiers de l'app
    url.hostname === 'cdn.jsdelivr.net';        // librairie Supabase

  // Tout le reste (API Supabase, photos signées…) : réseau direct, sans cache
  if (!cacheable) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        // Navigation hors ligne vers une page inconnue → page d'accueil
        if (request.mode === 'navigate') {
          const home = await caches.match('./index.html');
          if (home) return home;
        }
        return new Response('Hors ligne', { status: 503, statusText: 'Offline' });
      })
  );
});
