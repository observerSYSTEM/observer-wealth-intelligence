# PWA And Offline Mode

The frontend is installable through `public/manifest.webmanifest` and `public/sw.js`. The service worker caches only the app shell, manifest, icon, offline page, and static Next.js assets. API routes and private binary content are not cached by the service worker.

Read-only offline support is implemented in the frontend API client. Whitelisted private GET responses for dashboard, portfolio, goals, timeline, assets, receipts, vault, and notifications are cached in browser storage after successful online reads. When offline or when a network request fails, the app may serve that cached read data.

State-changing requests are blocked while offline. Logout and session-expiry clear the private offline cache. The shared app frame displays connection state so users can tell when they are viewing cached data.
