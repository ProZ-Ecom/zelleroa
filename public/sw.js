/**
 * Zellora Progressive Web App (PWA) Service Worker
 * Version: 1.0.0
 */

const CACHE_NAME = 'zellora-pwa-v1';

// Static assets essential for offline shell
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/logo-mark.png',
  '/logo.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32x32.png',
  '/icons/favicon-16x16.png',
];

// Install: Cache essential offline shell assets and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Pre-caching error during install:', err);
      })
  );
});

// Activate: Clean up legacy caches and take control of all active clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch event handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Only process GET requests from same origin (or CDN assets)
  if (request.method !== 'GET') {
    return;
  }

  // 2. Never cache or intercept chrome-extension or other non-http protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. Bypass caching completely for API routes, auth, admin, and dynamic checkouts
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/agent') ||
    url.pathname.startsWith('/checkout')
  ) {
    return;
  }

  // 4. HTML Navigations (Network-first with offline fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const offlinePage = await caches.match('/offline.html');
          return (
            offlinePage ||
            new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' },
            })
          );
        })
    );
    return;
  }

  // 5. Static Next.js assets, fonts, icons, images (Stale-While-Revalidate)
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif|ico|woff|woff2|ttf|css|js)$/i);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 6. Default fetch handler with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Allow clients to trigger skipWaiting on demand (for seamless app updates)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
