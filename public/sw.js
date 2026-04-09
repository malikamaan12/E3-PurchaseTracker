const CACHE_NAME = 'purchase-tracker-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// ─── NATIVE PUSH LISTENER ────────────────────────────────────────────────
// Future-proofing for when VAPID keys are integrated into the backend
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'PurchaseTracker', message: 'New update available' };
  
  const options = {
    body: data.message,
    icon: '/logo-color.png',
    badge: '/logo-color.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/dashboard/requests'
    },
    actions: [
      { action: 'open', title: 'View Request' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ─── NOTIFICATION INTERACTION ──────────────────────────────────────────
// Seamless SPA navigation using clients.matchAll and focus()
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Try to find an existing tab and focus it
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // 2. If no tab is open with that exact URL, find any dashboard tab and navigate it
      for (const client of windowClients) {
        if (client.url.includes('/dashboard') && 'navigate' in client) {
          return client.navigate(urlToOpen).then(c => c?.focus());
        }
      }
      // 3. Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
