self.addEventListener('push', function(event){
  var data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { title: 'D-Ploy Camp', body: event.data ? event.data.text() : '' }; }
  var title = data.title || 'D-Ploy Camp';
  var options = {
    body: data.body || '',
    tag: data.tag || 'dploy-push',
    renotify: true,
    requireInteraction: !!data.requireInteraction,
    dir: 'rtl',
    lang: 'ar',
    data: { url: (data.data && data.data.url) || 'https://atif-alamodi.github.io/d-ploy-camp/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || 'https://atif-alamodi.github.io/d-ploy-camp/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url.indexOf('/d-ploy-camp/') >= 0 && 'focus' in c) {
          if ('navigate' in c) { try { c.navigate(url); } catch (e) {} }
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(event){ event.waitUntil(self.clients.claim()); });
