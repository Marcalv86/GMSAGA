// Service Worker unregistration & cache cleaner for GM Studio
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(names => Promise.all(names.map(n => caches.delete(n))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim())
  );
});

