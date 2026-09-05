/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope;

// Cache the API routes for offline use when the Django server is unreachable
registerRoute(
  ({ url }) => url.hostname.includes("localhost") || url.hostname.includes("127.0.0.1"),
  new NetworkFirst({
    cacheName: "api-cache",
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 }),
    ],
  })
);

// Precache the app shell only when the manifest is provided by NextPWA
if (self.__WB_MANIFEST && self.__WB_MANIFEST.length) {
  precacheAndRoute(self.__WB_MANIFEST);
} else {
  // Fallback: cache the root and manifest so the PWA works offline even without precaching
  self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.url.endsWith("/") || req.url.endsWith("/manifest.json") || req.url.includes("/icons/")) {
      event.respondWith(
        fetch(req).catch(() => caches.match(req)).then((response) => {
          if (response) {
            const clone = response.clone();
            caches.open("shell").then((cache) => cache.put(req, clone));
          }
          return response;
        })
      );
    }
  });
}

// Cache static assets first
registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "images",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
);

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
