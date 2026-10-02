import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function walk(dir) {
  let out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...(await walk(dir + "/" + e.name)));
    else out.push(dir + "/" + e.name);
  }
  return out;
}
const files = (await walk("dist/client")).filter(
  (p) =>
    !p.endsWith(".wasm") &&
    !p.endsWith(".apk") &&
    !p.startsWith("dist/client/downloads/") &&
    !p.endsWith("/sw.js"),
);
const digest = createHash("sha256");
for (const f of files) digest.update(await readFile(f));
const cache = "murmur-shell-" + digest.digest("hex").slice(0, 12);
const paths = files.map((p) => "/" + p.slice("dist/client/".length));
paths.push("/");
await writeFile(
  "dist/client/sw.js",
  `const CACHE=${JSON.stringify(cache)};const ASSETS=${JSON.stringify(paths)};\nself.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));\nself.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('murmur-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));\nself.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==self.location.origin||e.request.method!=='GET')return;if(e.request.mode==='navigate'&&u.pathname==='/'){e.respondWith((async()=>{try{const r=await fetch(e.request);if(r.ok){const c=await caches.open(CACHE);await c.put('/',r.clone());return r;}throw Error('offline');}catch{return(await caches.match('/',{ignoreVary:true}))||Response.error();}})());return;}if(ASSETS.includes(u.pathname))e.respondWith((async()=>{const c=await caches.open(CACHE);const hit=await c.match(e.request,{ignoreVary:true});if(hit)return hit;const r=await fetch(e.request);if(r.ok&&r.headers.get('content-type')?.includes('text/html')!==true)await c.put(e.request,r.clone());return r;})());});\n`,
);
console.log(
  "Offline app shell generated. Android model files are managed by the native runtime.",
);
