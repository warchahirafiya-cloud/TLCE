# QuestPulse Smart PWA foundation

QuestPulse remains an internal module of The Last Cosmic Explosion (TLCE). This PWA shell is a web presentation surface for that module; it does not create a second product runtime.

## Included

- Responsive, accessible HTML/CSS shell in `modules/questpulse/web/`.
- Web App Manifest with relative `start_url` and `scope`, suitable for hosting under a subpath.
- Vector SVG app icon.
- Browser install-prompt handling where the browser supports `beforeinstallprompt`.
- Service worker with a versioned, explicit static-shell cache allowlist.
- Offline navigation fallback to the cached app shell.
- Automated contract tests for manifest scope, caching boundaries, and honest prototype messaging.

## Activation and hosting requirements

A service worker requires a secure context: HTTPS, or localhost during development. Serve the contents of `modules/questpulse/web/` as a static directory without rewriting its relative paths. The registered scope is intentionally limited to that directory. Do not move the service worker to a broader parent scope without a separate security review.

For local smoke testing, serve the repository root with any static HTTP server and open:

`/modules/questpulse/web/`

Then verify in browser developer tools:
1. The manifest loads and parses.
2. The service worker installs and reaches Activated.
3. The page reloads while offline and displays the cached shell.
4. A new cache version removes only older caches with the `tlce-questpulse-shell-` prefix.
5. Install UI appears only on browsers that expose the install-prompt event; other browsers can use their own browser menu if offered.

## Cache and security policy

- Only same-origin GET requests matching the static shell allowlist are handled.
- Non-GET requests, cross-origin requests, API calls and unlisted resources are not cached by this worker.
- No authentication tokens, user data, opportunity records or API responses are placed in Cache Storage.
- Offline mode provides the shell only; it does not imply that dynamic listings or verification are available offline.
- The URL scanner remains a local structural heuristic, not a reputation service or safety verdict.

## Known limitations / next gates

- This is a foundation shell, not a complete QuestPulse interface. It is not yet wired to the TLCE production hosting entry point or a live opportunity catalog.
- Browser installability varies. The manifest currently uses a scalable SVG icon; add platform-specific raster icons after visual and browser validation if required.
- No deployment, DNS, hosting configuration, authentication, analytics, push notifications or third-party integrations are enabled by this change.
- Do not claim installation or production activation until the app is served over HTTPS and verified on target browsers/devices.

## Validation

The `modules/questpulse/test/pwa.test.ts` checks static PWA contracts. It does not replace a browser-based install/offline smoke test. CI status must be checked against the exact resulting commit before describing the changes as passing.
