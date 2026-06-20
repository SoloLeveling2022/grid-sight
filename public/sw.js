const CACHE_NAME = "gridsight-cache-v1";
const OFFLINE_URL = "/offline";

const STATIC_ASSETS = [
  "/",
  "/offline",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/globe.svg",
  "/next.svg",
  "/window.svg",
];

// Install Event: Cache Core Static Assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching static resources...");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event: Cleanup Old Caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Implement Network-First with Cache-Fallback
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip API routes, TomTom maps queries, and Next.js dev server hot reload web sockets
  if (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.hostname.includes("tomtom.com")
  ) {
    return;
  }

  // Page Navigation: Network-First, Offline Fallback to cached HTML or /offline
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the latest page load
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If network is down, check cache for the request
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            // Otherwise, return the offline fallback page
            return caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // Static Assets (CSS, JS, Images, Fonts): Cache-First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in the background (stale-while-revalidate pattern)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* Ignore network errors for background update */});
        
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200 && networkResponse.type === "basic") {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Silently fail if resource cannot be fetched offline
        });
    })
  );
});
