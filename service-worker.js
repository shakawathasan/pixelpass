const CACHE_VERSION = 'pixelpass-v1';

const ASSETS = [
  './',
  './index.html',
  './worker.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {

  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {

  event.waitUntil(
    Promise.all([
      self.clients.claim(),

      caches.keys().then(keys =>
        Promise.all(
          keys.map(key => {
            if (key !== CACHE_VERSION) {
              return caches.delete(key);
            }
          })
        )
      )
    ])
  );
});

self.addEventListener('fetch', event => {

  if (event.request.method !== 'GET') return;

  event.respondWith(

    caches.match(event.request)
      .then(cached => {

        if (cached) {
          return cached;
        }

        return fetch(event.request)
          .then(response => {

            const clone = response.clone();

            caches.open(CACHE_VERSION)
              .then(cache => cache.put(event.request, clone));

            return response;
          });
      })
  );
});