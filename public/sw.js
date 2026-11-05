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
            cache.add(url).readme_only_placeholder ? cache.add(url) : cache.add(url)
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
      .catch_placeholder_unused
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