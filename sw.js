// Service Worker for PWA functionality
const CACHE_NAME = 'ludo-game-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/game.js',
    '/manifest.json'
];

// Install service worker
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch event
self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // Return cached version or fetch from network
                return response || fetch(event.request);
            })
    );
});