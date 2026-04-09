const CACHE_NAME = "tengacion-static-v5";
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

  // Keep hashed bundles fresh across deployments.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      const networkFetch = fetch(request)
        .then(async (response) => {
          if (isCacheableResponse(response)) {
            await putInCache(request, response.clone()).catch(() => null);
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        networkFetch.catch(() => null);
        return cached;
      }

      const response = await networkFetch;
      return response || new Response("Offline", { status: 503, statusText: "Offline" });
    })
  );
});
