const CACHE_VERSION = "v2";
const CACHE_NAME = `forgex-${CACHE_VERSION}`;
const PRECACHE_URLS = ["/", "/help", "/studio"];
const MONACO_PRECACHE_URLS = [
  "/monaco/vs/loader.js",
  "/monaco/vs/editor/editor.main.js",
  "/monaco/vs/editor/editor.main.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled([
          ...PRECACHE_URLS.map((url) =>
            cache.add(url).catch(() => undefined),
          ),
          ...MONACO_PRECACHE_URLS.map((url) =>
            cache.add(url).catch(() => undefined),
          ),
        ]),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function hasSensitiveHeader(request) {
  return [...request.headers.keys()].some((name) => {
    const lower = name.toLowerCase();
    return lower === "rsc" || lower.startsWith("next-router-");
  });
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/monaco/") ||
    pathname.startsWith("/brand/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    /\.(?:woff2?|ttf|otf|eot|png|jpg|jpeg|webp|gif|ico|svg)$/i.test(pathname)
  );
}

function offlineFallback(request, error) {
  return caches
    .match(request)
    .then((cached) => {
      if (cached) return cached;
      return caches.match("/studio").then((fallback) => {
        if (fallback) return fallback;
        throw error;
      });
    });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;
  if (url.pathname.startsWith("/api/")) return;
  if (hasSensitiveHeader(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
          return response;
        } catch (error) {
          return offlineFallback(request, error);
        }
      })(),
    );
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
          return response;
        } catch (error) {
          throw error;
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw error;
      }
    })(),
  );
});