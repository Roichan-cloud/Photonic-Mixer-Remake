
self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys.map(key => caches.delete(key))
    );

    await self.clients.claim();

    console.log("[IAN LIGHTING] Cache berhasil dibersihkan");
  })());
});
