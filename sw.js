const C='umascope-auto-v181',A=['./','./index.html','./core.js','./manifest.webmanifest','./bookmarklet.txt'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(A)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x))))])));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.mode==='navigate'||/\/(?:index\.html|core\.js|bookmarklet\.txt)$/.test(u.pathname)){e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const x=r.clone();caches.open(C).then(c=>c.put(e.request,x));return r}).catch(()=>caches.match(e.request)));return}e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
