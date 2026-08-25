const CACHE_VERSION = 'v1'
const STATIC_CACHE = `static-${CACHE_VERSION}`
const OFFLINE_URL = '/offline.html'

const PRECACHE_URLS = [OFFLINE_URL, '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Only ever handle same-origin requests. Cross-origin calls (Google Books, Open Library,
  // Ollama/OpenAI, etc.) must always hit the network directly, untouched by this worker.
  if (url.origin !== self.location.origin) return

  // Full page navigations: try the network first, fall back to the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  // Hashed build assets and icons are immutable, so cache-first is safe and fast.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            const copy = res.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
            return res
          }),
      ),
    )
  }
  // Everything else (server functions, data requests) is left alone — network only.
})
