const V="binbuddy-v5",SHELL=["./","index.html","css/app.css","js/app.js","js/ai-barcode.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/favicon.png","icons/apple-touch-icon.png"];
const okHost=u=>u.origin===location.origin||/(^|\.)(jsdelivr\.net|gstatic\.com|googleapis\.com)$/.test(u.hostname);
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener("fetch",e=>{const r=e.request,u=new URL(r.url);if(r.method!=="GET"||!okHost(u))return;
e.respondWith(caches.match(r).then(h=>h||fetch(r).then(n=>{
 // v5: only cache good responses (or opaque cross-origin ones), never errors or partial content
 if(n&&(n.ok||n.type==="opaque")&&n.status!==206){const c=n.clone();caches.open(V).then(x=>x.put(r,c))}return n
}).catch(()=>r.mode==="navigate"?caches.match("index.html"):Response.error())))});
