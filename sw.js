// Service Worker for GoToU Web App - No Caching
// This service worker registers the app as a PWA without any caching functionality

// Install event - just complete installation
self.addEventListener('install', function(event) {
  console.log('Service worker installed');
  self.skipWaiting();
});

// Activate event - take control immediately
self.addEventListener('activate', function(event) {
  console.log('Service worker activated');
  event.waitUntil(self.clients.claim());
});

// Fetch event - always fetch from network
self.addEventListener('fetch', function(event) {
  event.respondWith(fetch(event.request));
});
