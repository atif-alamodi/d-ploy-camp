const CACHE_NAME = 'dploy-v1';
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(clients.claim()); });
self.addEventListener('push', function(event){
  if (!event.data) return;
  var data = {};
  try { data = event.data.json(); } catch(e){ data = { title:'D-Ploy', body:event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title||'D-Ploy Camp', {
    body: data.body||'',
    icon: 'https://atif-alamodi.github.io/d-ploy-camp/icon-192.png',
    badge: 'https://atif-alamodi.github.io/d-ploy-camp/icon-192.png',
    tag: data.tag||'dploy-push',
    requireInteraction: !!data.requireInteraction,
    data: data.data||{},
    dir: 'rtl', lang: 'ar'
  }));
});
self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var url = (event.notification.data&&event.notification.data.url)
    ? event.notification.data.url
    : 'https://atif-alamodi.github.io/d-ploy-camp/';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(function(wins){
    for(var i=0;i<wins.length;i++){
      var w=wins[i];
      if(w.url.indexOf('d-ploy-camp')!==-1&&'focus' in w){ w.navigate(url); return w.focus(); }
    }
    if(clients.openWindow) return clients.openWindow(url);
  }));
});
