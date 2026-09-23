// Apex Fitness Tracker — Service Worker
//
// This file is registered by script.js via navigator.serviceWorker.register('sw.js').
// A working service worker with a fetch handler is what lets Chrome on Android treat
// this app as reliably "installable" (offline-capable), and it's also what makes the
// app open instantly and keep working with a spotty/offline connection once installed.
//
// Strategy: cache-first for the app shell (HTML/JS/manifest/icons) with an automatic
// background update, and network-first for everything else (e.g. the Gemini API calls),
// falling back to cache only if a previously-cached copy exists.

const CACHE_NAME = 'apex-fitness-cache-v1';

// Keep this list to same-origin files that always exist for the app to boot.
const APP_SHELL = [
  './',
  './index.html',
  './script.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle simple GET navigations/assets; let everything else (e.g. POSTs
  // to the Gemini API) pass straight through to the network untouched.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    // App shell: cache-first, refreshing the cache in the background.
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  } else {
    // Cross-origin (Gemini API, CDN scripts, fonts, etc.): network-first,
    // only falling back to cache if we happen to have a prior copy.
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
  }
});
