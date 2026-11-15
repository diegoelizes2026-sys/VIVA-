const VERSION = "viva-pwa-v6";
const SHELL = ["/offline.html", "/favicon.svg", "/icons/viva-192.svg", "/icons/viva-512.svg"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("viva-pwa-") && key !== VERSION).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("message", event => { if (event.data?.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let data = {};
    try { data = event.data?.json() || {}; } catch {}
    const isAlarm = data.notificationType === "agenda" || data.type === "agenda";
    await self.registration.showNotification(data.title || "VIVA+", {
      body: data.body || "Você tem uma atualização no VIVA+.",
      icon: "/icons/viva-192.svg", badge: "/icons/viva-192.svg",
      tag: data.tag || ("viva-" + (data.deliveryId || Date.now())),
      renotify: Boolean(isAlarm), requireInteraction: Boolean(isAlarm || data.requireInteraction),
      vibrate: isAlarm ? [300,100,300,100,600] : [120,60,120], data,
      actions: isAlarm ? [{action:"ack",title:"Estou ciente"},{action:"snooze",title:"Adiar 10 min"}] : [{action:"open",title:"Abrir"}]
    });
    const clients = await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for (const client of clients) client.postMessage({type:"VIVA_ALARM",payload:data});
  })());
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const data = event.notification.data || {};
    if (data.deliveryId) {
      const action = event.action === "ack" ? "ack" : event.action === "snooze" ? "snooze" : "opened";
      await fetch("/api/notifications/ack",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({delivery_id:data.deliveryId,action})}).catch(()=>{});
    }
    if (event.action === "ack" || event.action === "snooze") return;
    const raw = data.targetUrl || (data.notificationType === "agenda" ? "/agenda" : data.notificationType === "bill" ? "/contas" : "/assistente");
    const target = new URL(raw,self.location.origin);
    if (target.origin !== self.location.origin) return;
    const windows = await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for (const client of windows) if ("focus" in client) { await client.focus(); if ("navigate" in client) await client.navigate(target.href); return; }
    if (self.clients.openWindow) await self.clients.openWindow(target.href);
  })());
});
self.addEventListener("pushsubscriptionchange", event => {
  event.waitUntil((async () => {
    try {
      const key = self.VIVA_VAPID_PUBLIC_KEY;
      if (!key) return;
      const subscription = await self.registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
      await fetch("/api/notifications/subscription",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({...subscription.toJSON(),userAgent:"service-worker-renewal"})});
    } catch (error) { console.error("VIVA push subscription renewal failed",error); }
  })());
});
self.addEventListener("fetch", event => {
  const request=event.request,url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==self.location.origin)return;
  if(request.mode==="navigate"){event.respondWith(fetch(request).catch(async()=>(await caches.match(request))||(await caches.match("/offline.html"))));return;}
  const asset=url.pathname.startsWith("/_next/static/")||/\.(?:css|js|svg|png|webp|woff2?)$/i.test(url.pathname);
  if(!asset)return;
  event.respondWith((async()=>{const cache=await caches.open(VERSION);try{const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;}catch{return(await cache.match(request))||Response.error();}})());
});
