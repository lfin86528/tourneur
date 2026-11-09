// The former site installed its admin (Sveltia CMS) as an app with a service worker
// at /admin/. This replacement removes it: phones that still have it get the new site.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  for (const key of await caches.keys()) await caches.delete(key);
  await self.registration.unregister();
  for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate('/login');
})()));
