// Service Worker khusus Push Notification — tidak ada cache
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCcJH1ZbQhyuKzu1W5ETut59xlLdzejkWE",
  authDomain: "photonic-mixer-remake.firebaseapp.com",
  projectId: "photonic-mixer-remake",
  storageBucket: "photonic-mixer-remake.firebasestorage.app",
  messagingSenderId: "924318711559",
  appId: "1:924318711559:web:f2249624c4ee1be35b8fa2"
});

const messaging = firebase.messaging();

// Terima notif saat app di background/tertutup
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'Pothonic Mixer Pro', {
    body: body || '',
    icon: icon || '/Photonic-Mixer-Remake/app.png',
    badge: '/Photonic-Mixer-Remake/app.png',
    vibrate: [200, 100, 200],
    data: payload.data || {}
  });
});

// Klik notif → buka app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for(const client of clientList) {
        if(client.url.includes('Photonic-Mixer-Remake') && 'focus' in client) return client.focus();
      }
      return clients.openWindow('https://roichan-cloud.github.io/Photonic-Mixer-Remake/');
    })
  );
});
