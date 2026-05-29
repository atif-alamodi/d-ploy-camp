// D-Ploy Camp Service Worker
// Provides: offline shell, push notifications, click-to-focus

const CACHE_NAME = 'dploy-camp-v2';
const SCOPE = self.registration.scope;

// Files to cache for offline use
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.ico'
];

// ============================================
// INSTALL
// ============================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(() => {
        // If precache fails (e.g., icons missing), still install
        return Promise.resolve();
      }))
      .then(() => self.skipWaiting())
  );
});

// ============================================
// ACTIVATE: cleanup old caches
// ============================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )),
      self.clients.claim()
    ])
  );
});

// ============================================
// FETCH: network-first for HTML, cache-first for assets
// ============================================
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== 'GET') return;

  // Skip cross-origin (Supabase, CDN, Google Fonts) - let them go straight to network
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Skip Supabase realtime endpoints
  if (url.pathname.includes('/realtime') || url.pathname.includes('/auth/')) return;

  // Network-first for HTML (always try fresh)
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then(resp => {
          // Update cache in background
          if (resp.ok) {
            const respClone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, respClone)).catch(() => {});
          }
          return resp;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for assets (fonts, icons, etc.)
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        if (resp.ok) {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, respClone)).catch(() => {});
        }
        return resp;
      }).catch(() => cached);
    })
  );
});

// ============================================
// PUSH: receive push notifications (Web Push)
// ============================================
self.addEventListener('push', function(event) {
  if (!event.data) return;
  var data = {};
  try { data = event.data.json(); } catch(e){ data = { title:'D-Ploy', body:event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'D-Ploy Camp', {
    body: data.body || '',
    icon: 'https://atif-alamodi.github.io/d-ploy-camp/icon-192.png',
    badge: 'https://atif-alamodi.github.io/d-ploy-camp/icon-192.png',
    tag: data.tag || 'dploy-push',
    requireInteraction: !!data.requireInteraction,
    data: data.data || {},
    dir: 'rtl', lang: 'ar'
  }));
});

// ============================================
// NOTIFICATION CLICK: notify tabs, then navigate or open
// ============================================
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : 'https://atif-alamodi.github.io/d-ploy-camp/';
  var notifData = event.notification.data || {};
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(wins) {
      // Notify all open tabs so they can mark the notification as read.
      // Post both the new type and the legacy type the in-page handler listens for.
      wins.forEach(function(w) {
        w.postMessage({ type: 'notification-clicked', url: url, data: notifData });
        w.postMessage({ type: 'notification-click', url: url, data: notifData });
      });
      // Navigate an existing tab or open a new one
      for (var i = 0; i < wins.length; i++) {
        var w = wins[i];
        if (w.url.indexOf('d-ploy-camp') !== -1 && 'focus' in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ============================================
// MESSAGE: allow page to talk to SW
// ============================================
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
