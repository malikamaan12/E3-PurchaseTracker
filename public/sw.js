const CACHE_NAME = 'purchase-tracker-v2-stable';
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/logo-color.png',
  '/logo-white.png',
];

// Install Event: Cache immutable visual shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Cache addAll skipped non-critical assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event: Clear older caches immediately
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

// Fetch Event: Optimized routing to prevent worker thread deadlocks & UI freezing
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }

  // Only handle standard http/https schemes
  if (!url.protocol.startsWith('http')) return;

  // --- PASS-THROUGH: Dynamic APIs, Next.js internal chunks, RSC streams, and Auth routes ---
  // Completely bypass Service Worker interception to guarantee instant Next.js streaming & zero hydration stall
  if (
    url.pathname.startsWith('/api/') || 
    url.pathname.includes('/auth/') ||
    url.pathname.startsWith('/_next/') ||
    event.request.headers.get('RSC') === '1' ||
    event.request.headers.get('Next-Router-State-Tree') ||
    event.request.headers.get('Next-Url')
  ) {
    return;
  }

  // Navigation requests: Network-First with safe fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        return new Response('Offline - Please reconnect to access PurchaseTracker.', {
          status: 503,
          statusText: 'Offline',
          headers: { 'Content-Type': 'text/plain' }
        });
      })
    );
    return;
  }

  // Static assets (images, icons, fonts, manifest)
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|woff2?|json)$/i)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkFetch = fetch(event.request)
          .then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
              cache.put(event.request, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
    return;
  }
});

// PUSH EVENT: Native System Alerts
self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : { 
      title: 'Procurement Alert', 
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
  } catch (err) {
    console.error('[SW] Push notification error:', err);
  }
});

// Notification Click Event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard/requests';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
