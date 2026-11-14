const CACHE_PREFIX = "tlce-questpulse-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const SHELL_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const shellUrls = new Set(SHELL_FILES.map((file) => new URL(file, self.registration.scope).href));
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(new URL("./index.html", self.registration.scope).href))
          ?? Response.error();
      }),
    );
    return;
  }

  if (!shellUrls.has(requestUrl.href)) return;
  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
});
