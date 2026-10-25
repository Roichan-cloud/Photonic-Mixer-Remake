/**
 * Service Worker Ian Lighting - mode offline.
 * - Pertama kali dibuka online: library & file inti disimpan di cache.
 * - Setelah itu web bisa dibuka tanpa internet.
 * - Naikkan VERSION setiap kali kamu mengubah index.html, supaya cache lama dibuang.
 */
const VERSION = '8.8';
const CACHE = 'ian-lighting-' + VERSION;

// File milik web sendiri (di repo yang sama)
const LOCAL_ASSETS = ['./', './index.html', './manifest.json', './app.png', './app-v2-192.png', './app-v2-512.png', './logo.png', './firebase-config.js'];

// Library wajib: tanpa ini aplikasi tidak bisa jalan.
const CDN_REQUIRED = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/fflate@0.7.4/umd/index.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/OBJLoader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/FBXLoader.js'
];

// Library opsional (Firebase): kalau gagal diunduh, instalasi tetap jalan.
const CDN_OPTIONAL = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js'
];

// Host yang boleh di-cache saat dipakai
const CACHEABLE_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Hanya unduh yang BELUM ada di cache
    const addIfMissing = async (u) => { if (!(await cache.match(u))) await cache.add(new Request(u, { cache: 'reload' })); };
    // Wajib berhasil semua
    await Promise.all(CDN_REQUIRED.map(addIfMissing));
    // Sisanya: simpan sebisanya
    await Promise.allSettled(LOCAL_ASSETS.concat(CDN_OPTIONAL).map(addIfMissing));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('ian-lighting-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Halaman HTML: coba internet dulu (supaya update langsung masuk), kalau gagal pakai cache
async function networkFirst(request, timeoutMs) {
  const cache = await caches.open(CACHE);
  // cache:'no-cache' = selalu tanya server dulu (304 kalau tidak berubah)
  const fromNetwork = fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
    if (res && res.status === 200) cache.put(request, res.clone());
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));
  try {
    const res = await Promise.race([fromNetwork, timeout]);
    if (res) return res;
  } catch (e) {}
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  return fromNetwork;
}

// File lain: cache dulu, kalau belum ada ambil dari internet lalu simpan
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && (res.status === 200 || res.type === 'opaque')) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.search.indexOf('__chk=') !== -1) return;   // pengecek versi: langsung ke server
  if (url.origin === self.location.origin) {
    const isPage = req.mode === 'navigate' || /\.(html?)$/i.test(url.pathname) || url.pathname.endsWith('/');
    event.respondWith(isPage ? networkFirst(req, 3500) : cacheFirst(req));
    return;
  }
  if (CACHEABLE_HOSTS.indexOf(url.hostname) !== -1) event.respondWith(cacheFirst(req));
});
