const CACHE_NAME = 'purchase-tracker-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/logo-color.png',
  '/logo-white.png',
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Stale-while-revalidate for assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // --- SECURITY & STABILITY HARDENING: Bypass cache for API, AUTH and Next.js internal chunks ---
  // API/Auth: Prevents sensitive financial JSON and identity data from being cached.
  // _next/static: Prevents ChunkLoadError by ensuring hashed assets are ALWAYS fresh.
  if (
    url.pathname.startsWith('/api/') || 
    url.pathname.includes('/auth/') ||
    url.pathname.includes('/_next/static/')
  ) {
    console.log(`[SW] Bypassing cache for internal/secure route: ${url.pathname}`);
    return; // Network Only
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networked = fetch(event.request)
        .then((response) => {
          if (url.protocol.startsWith('http')) {
            const cacheCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, cacheCopy);
            });
          }
          return response;
        })
        .catch(() => cached);

      return cached || networked;
    })
  );
});

// PUSH EVENT: Native System Alerts
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { 
    title: 'Intelligence Alert', 
    body: 'New procurement update received.' 
  };

  const options = {
    body: data.body,
    icon: '/icon-512.png',
    badge: '/logo-color.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/dashboard/requests'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
