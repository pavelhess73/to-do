self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Projít všemi requesty přímo na síť (nejjednodušší PWA SW pro splnění podmínek instalace)
  e.respondWith(fetch(e.request).catch(() => {
    return new Response('Offline');
  }));
});
