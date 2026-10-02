/* Ian Lighting - Service Worker (mode offline)
 * - Pembukaan pertama harus online: semua file & library disimpan ke cache.
 * - Setelah itu web bisa dibuka tanpa internet.
 * Naikkan VERSION setiap kali kamu ingin memaksa cache lama diganti.
 */
const VERSION = '8.6';
const CACHE = 'ian-lighting-' + VERSION;

// File milik web sendiri (di repo yang sama). Kalau salah satu tidak ada, yang lain tetap disimpan.
const LOCAL_ASSETS = ['./', './index.html', './manifest.json', './logo.png', './app.png', './firebase-config.js'];

// Library wajib: tanpa ini aplikasi tidak bisa jalan.
const CDN_REQUIRED = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/fflate@0.7.4/umd/index.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/OBJLoader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/FBXLoader.js'
];

// Library opsional (Firebase): kalau gagal diunduh, instalasi tetap lanjut.
const CDN_OPTIONAL = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js'
];

// Host yang boleh di-cache saat dipakai (termasuk konverter MP4 yang dimuat sesudah dipakai sekali).
const CACHEABLE_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'www.gstatic.com', 'unpkg.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Hanya unduh yang BELUM ada di cache. Jadi saat sw.js diperbarui (tanpa mengganti VERSION),
    // pengguna tidak mengunduh ulang library/gambar yang sudah tersimpan. File web sendiri
    // (index.html dst.) tetap selalu diperbarui otomatis lewat strategi network-first / stale-while-revalidate.
    const addIfMissing = async (u) => { if (!(await cache.match(u))) await cache.add(u); };
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

// Halaman HTML: coba internet dulu (supaya update langsung masuk), kalau lambat/mati pakai cache.
async function networkFirst(request, timeoutMs) {
  const cache = await caches.open(CACHE);
  // cache:'no-cache' = selalu tanya server dulu (304 kalau tidak berubah), jadi update langsung terbaca
  const fromNetwork = fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  });
  try {
    return await Promise.race([
      fromNetwork,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))
    ]);
  } catch (e) {
    const cached = (await cache.match(request, { ignoreSearch: true })) || (await cache.match('./index.html'));
    if (cached) return cached;
    return fromNetwork; // tidak ada cache sama sekali: tunggu hasil internet
  }
}

// File lokal biasa: tampilkan dari cache dulu, sambil diam-diam diperbarui di belakang.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const update = fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await update) || Response.error();
}

// Library CDN (versi sudah dikunci): cache dulu, kalau belum ada ambil dari internet lalu simpan.
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Server Firebase/Firestore & lainnya: biarkan browser yang urus (tidak di-cache).
  if (url.origin !== self.location.origin && !CACHEABLE_HOSTS.includes(url.hostname)) return;

  if (url.origin === self.location.origin) {
    // Pengecekan versi baru dari halaman (?__chk=...): langsung ke server, jangan disimpan di cache
    if (url.searchParams.has('__chk')) return;
    if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
      event.respondWith(networkFirst(req, 4000));
    } else {
      event.respondWith(staleWhileRevalidate(req));
    }
    return;
  }
  event.respondWith(cacheFirst(req));
});
