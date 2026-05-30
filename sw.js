const CACHE_VERSION = 'v' + Date.now(); // auto-update setiap SW di-deploy ulang
const CACHE_NAME = 'pothonic-mixer-' + CACHE_VERSION;
const STATIC_ASSETS = [
  '/Pothonic-Mixer-Remake/',
  '/Pothonic-Mixer-Remake/index.html',
  '/Pothonic-Mixer-Remake/manifest.json',
  '/Pothonic-Mixer-Remake/app.png',
];

// Install — cache asset utama
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  // Langsung aktif tanpa tunggu tab lama ditutup
  self.skipWaiting();
});

// Activate — hapus semua cache lama
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — Network First untuk HTML, Cache First untuk aset lain
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isHTML = e.request.destination === 'document' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/');

  if(isHTML) {
    // HTML: selalu ambil dari network dulu, fallback ke cache
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Aset lain (CDN dll): cache first
    e.respondWith(
      caches.match(e.request).then(cached => {
        if(cached) return cached;
        return fetch(e.request).then(res => {
          if(res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
  }
});

// Pesan dari client untuk skip waiting
self.addEventListener('message', e => {
  if(e.data === 'skipWaiting') self.skipWaiting();
});
