const CACHE_NAME = "tengacion-static-v6";
const OFFLINE_URL = "/offline.html";
const ASSETS = [OFFLINE_URL, "/manifest.json"];

const isCacheableResponse = (response) =>
  Boolean(response && response.ok && response.status === 200 && response.type !== "opaque");

const putInCache = async (request, response) => {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
};

const networkFirst = async (request, fallbackToOfflinePage = false) => {
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      await putInCache(request, response.clone()).catch(() => null);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    if (fallbackToOfflinePage) {
      const offline = await caches.match(OFFLINE_URL);
      if (offline) {
        return offline;
      }
    }
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
};

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      await putInCache(request, response.clone()).catch(() => null);
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
};

const staleWhileRevalidate = async (request, event) => {
  const cached = await caches.match(request);
  const networkFetch = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) {
        await putInCache(request, response.clone()).catch(() => null);
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(networkFetch);
    return cached;
  }

  const response = await networkFetch;
  return response || new Response("Offline", { status: 503, statusText: "Offline" });
};

const isHashedBuildAsset = (pathname) =>
  /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/i.test(pathname);

const isStaticAssetRequest = (request, pathname) =>
  pathname.startsWith("/assets/") ||
  ["font", "image", "manifest", "script", "style"].includes(request.destination);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (!(url.protocol === "http:" || url.protocol === "https:")) return;
  // Let the browser fetch third-party assets like Cloudinary images directly.
  if (url.origin !== self.location.origin) return;

  // Never cache API responses or auth-sensitive endpoints.
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/socket.io")) {
    return;
  }
  // Skip browser extension resources and byte-range media requests.
  if (url.protocol === "chrome-extension:" || request.headers.has("range")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, true));
    return;
  }

  // Hashed bundles never change in place, so serve them without a network round trip.
  if (isHashedBuildAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Serve other static files immediately when cached while refreshing them in the background.
  if (isStaticAssetRequest(request, url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, event));
});
