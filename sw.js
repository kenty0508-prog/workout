// Workout Log service worker v4.1.0
// ネットワーク優先（常に最新版を取得）＋オフライン時・電波が弱い時はキャッシュで起動。
// 記録データは localStorage にあり、ここでは一切扱わない。
const CACHE='workout-log-shell-v410';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./apple-touch-icon.png','./icon-192.png','./icon-512.png'];
const TIMEOUT_MS=4000;

self.addEventListener('install',e=>e.waitUntil(
  caches.open(CACHE)
    .then(c=>Promise.allSettled(ASSETS.map(u=>c.add(new Request(u,{cache:'reload'})))))
    .then(()=>self.skipWaiting())
));
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));

async function fromCache(req,isNav){
  const hit=await caches.match(req,{ignoreSearch:true});
  if(hit||!isNav)return hit;
  return (await caches.match('./index.html'))||(await caches.match('./'));
}

function networkFirst(req,isNav){
  return new Promise(resolve=>{
    let settled=false;
    const finish=r=>{if(!settled&&r){settled=true;resolve(r)}};
    // 電波が弱く応答しない場合は、キャッシュがあれば先にそれで起動する。
    const timer=setTimeout(()=>{fromCache(req,isNav).then(finish)},TIMEOUT_MS);
    fetch(req,{cache:'no-store'}).then(res=>{
      clearTimeout(timer);
      if(res&&res.ok&&res.type==='basic'){
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(isNav?'./index.html':req,copy)).catch(()=>{});
      }
      finish(res);
    }).catch(()=>{
      clearTimeout(timer);
      fromCache(req,isNav).then(r=>{if(!settled){settled=true;resolve(r||Response.error())}});
    });
  });
}

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  const isNav=req.mode==='navigate';
  e.respondWith(networkFirst(req,isNav));
});
