// Service worker: keeps a copy of the game on the device so it opens
// offline from the Home Screen. The build fills in PRECACHE with every
// built file, and a new build gets a new cache name so old copies are dropped.

const PRECACHE = self.__PRECACHE__;
const CACHE = `slimy-stretch-${PRECACHE.version}`;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE.files)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys.filter(k => k.startsWith('slimy-stretch-') && k !== CACHE).map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }
  if (request.mode === 'navigate') {
    // The page itself: try the network first so updates show up, fall back offline.
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html', { ignoreVary: true }))
    );
    return;
  }
  // Everything else has a content hash in its name, so the cached copy is always right.
  // ignoreVary: the game script is requested with an Origin header that the
  // cached copy wasn't, and some servers send "Vary: Origin".
  event.respondWith(caches.match(request, { ignoreVary: true }).then(hit => hit || fetch(request)));
});
