# PWA Validation

The PWA service worker caches the shell and static assets. Private API reads are cached by the frontend API client only for whitelisted read endpoints. Uploads, writes, receipt binaries, and vault binaries are not generally cached.

## Desktop Chrome Or Edge

- Confirm manifest loads.
- Confirm service worker registers.
- Confirm install prompt or app install UI is available.
- Launch standalone window.
- Load dashboard, goals, and timeline while online.
- Go offline.
- Confirm cached dashboard, goals, and timeline reads.
- Confirm writes and uploads are blocked offline.
- Confirm logout clears private offline cache.

## iPhone Safari

- Use Share, Add to Home Screen.
- Confirm icon and standalone launch.
- Confirm offline fallback behavior.

iOS Safari has platform limitations around install prompts, background sync, storage eviction, and service-worker behavior. Document actual device behavior during RC validation.
