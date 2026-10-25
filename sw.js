// Service worker pembersih: aplikasi tidak lagi memakai PWA.
// File ini hanya ada supaya perangkat yang dulu memasang PWA otomatis membuang cache lama
// dan melepas service worker lama. Boleh dihapus setelah beberapa minggu.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
    e.waitUntil(
        caches.keys()
            .then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })
            .then(function () { return self.registration.unregister(); })
            .then(function () { return self.clients.matchAll({ type: 'window' }); })
            .then(function (cs) { cs.forEach(function (c) { c.navigate(c.url); }); })
    );
});
