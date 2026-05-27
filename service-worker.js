// D-Ploy Camp Service Worker
// Provides: offline shell, push notifications, click-to-focus

const CACHE_NAME = 'dploy-camp-v1';
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
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    data = { title: 'D-Ploy Camp', body: event.data ? event.data.text() : 'إشعار جديد' };
  }
  
  const title = data.title || 'D-Ploy Camp';
  const options = {
    body: (data.body || '').substring(0, 200),
    icon: data.icon || './favicon.ico',
    badge: data.badge || './favicon.ico',
    tag: data.tag || ('dploy-push-' + Date.now()),
    requireInteraction: !!data.requireInteraction,
    silent: !!data.silent,
    data: data.data || {},
    actions: data.actions || [
      { action: 'open', title: '🚀 فتح' },
      { action: 'dismiss', title: '✖️ تجاهل' }
    ]
  };
  
  event.waitUntil(self.registration.showNotification(title, options));
});

// ============================================
// NOTIFICATION CLICK: focus or open the app
// ============================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // If the user clicked "dismiss", do nothing more
  if (event.action === 'dismiss') return;
  
  const targetUrl = event.notification.data?.url || SCOPE;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Find an existing tab and focus it
        for (const client of windowClients) {
          if (client.url.startsWith(SCOPE) && 'focus' in client) {
            // Send message to client about the clicked notification
            client.postMessage({
              type: 'notification-click',
              data: event.notification.data
            });
            return client.focus();
          }
        }
        // No tab open — open a new one
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
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
