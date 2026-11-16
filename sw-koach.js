/* KOACH · service worker mínimo: solo avisos push (fin de descanso, aviso del día y avisos del club · c281). No cachea nada: la app sigue cargando siempre la última versión. */
self.addEventListener('install', function(){ self.skipWaiting() })
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()) })
self.addEventListener('push', function(e){
  var d={}; try{ d=e.data?e.data.json():{} }catch(_){ d={ cuerpo:e.data&&e.data.text() } }
  e.waitUntil(self.registration.showNotification(d.titulo||'KOACH · Descanso terminado', {
    body:(d.cuerpo!=null?d.cuerpo:'Sigamos entrenando.'), tag:d.tag||'descanso', renotify:true, requireInteraction:false,
    icon:'/icon-192.png', badge:'/icon-96.png', vibrate:[200,80,200,80,320], data:{ url:(typeof d.url==='string'&&d.url.indexOf('/app')===0)?d.url:'/app.html' } }))
})
self.addEventListener('notificationclick', function(e){
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(function(cs){
    var u=(e.notification.data&&e.notification.data.url)||'/app.html', h=u.indexOf('#')>-1?u.slice(u.indexOf('#')):''
    for (var i=0;i<cs.length;i++){ if (cs[i].url.indexOf('/app')>-1 && 'focus' in cs[i]){ if(h) try{ cs[i].postMessage({ koachIr:h }) }catch(_){} return cs[i].focus() } }
    return self.clients.openWindow(u) }))
})
