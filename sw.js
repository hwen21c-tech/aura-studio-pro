/* ============================================================
   AURA Studio Pro — 독립 도메인(aura-studio-pro) 전용 SW
   · 관제탑(stock-dashboard-live)과 오리진이 달라 캐시·스코프가 분리된다.
   · 화면(HTML)·앱 스크립트: 네트워크 우선 → 실패하면 캐시 셸(오프라인에서도 UI 열림)
   · 악기 샘플(외부 CDN)은 브라우저 HTTP 캐시에 맡긴다.
   ============================================================ */
const PREFIX = 'aura-studio-pro-';
const VERSION = PREFIX + 'v1';
const SHELL = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  '/icons/aura-192.png',
  '/icons/aura-512.png',
  '/icons/aura-maskable-512.png',
  '/icons/aura-apple-180.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith(PREFIX) && k !== VERSION).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 악기 샘플 CDN·AI API 는 그대로 통과
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const cache = await caches.open(VERSION);
        cache.put('/index.html', fresh.clone()).catch(() => {});
        return fresh;
      } catch (_) {
        const cached = (await caches.match('/index.html')) || (await caches.match('/'));
        if (cached) return cached;
        return new Response('오프라인 상태입니다. 네트워크에 연결한 뒤 다시 열어 주세요.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
