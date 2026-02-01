// Very small service worker for caching core assets
const CACHE = 'neongrid-v1';
const ASSETS = [ '/', '/index.html', '/style.css', '/app.js', '/manifest.webmanifest' ];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))) });
self.addEventListener('fetch', e=>{ e.respondWith(caches.match(e.request).then(r=>r || fetch(e.request))) });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE?caches.delete(k):null)))) });