# TLCE React client component integration

The reusable React component is at `src/components/TLCEClient.tsx`.

## API contract

The component uses the routes implemented by `infrastructure/production-worker/index.ts`:

- `POST /api/files/presign` with `{ contentType, size }`.
- Direct `PUT` to the returned R2 presigned URL using the exact `requiredHeaders`.
- `POST /api/files/complete` with `{ objectKey }`.
- `POST /api/ai/chat` with `{ prompt }`; the Worker returns `{ provider, answer }`.

The Worker requires a valid Cloudflare Access browser session. Requests to Worker API routes use `credentials: "include"`; the browser never receives or sends `TLCE_API_KEYS_JSON`, HMAC credentials, provider API keys, or any Worker secret.

## Mounting

Pass the deployed Worker origin as configuration from the host application:

```tsx
import { TLCEPlatformUI } from "./components/TLCEClient";

<TLCEPlatformUI apiBaseUrl={import.meta.env.VITE_TLCE_API_BASE_URL} />
```

Set `VITE_TLCE_API_BASE_URL` to the actual Worker origin in the frontend build environment. It is a public URL, not a secret. Do not use a placeholder hostname in production.

The R2 bucket CORS policy must allow the exact public site origin and the signed PUT headers returned by the Worker. The Worker CORS policy is restricted to `https://tlce.store`; Cloudflare Access must be configured for the Worker hostname and the user's browser session.

## Upload state and security semantics

- Client-side file selection is limited to PNG, JPEG and PDF, maximum 5 MiB. The Worker independently validates these limits and file signatures.
- A successful completion response means the object was accepted into private quarantine and queued for structural inspection. It does **not** mean antivirus scanning passed.
- The UI deliberately does not simulate a delayed approval. The current Worker has no authenticated status-polling endpoint and no antivirus verdict/release workflow. It therefore displays the truthful quarantined/pending state and never claims that a file is approved or in production.
- Queue structural validation is not malware scanning. Objects remain private and quarantined; no production release is implemented.

## Current integration boundary

This file adds a reusable React/TypeScript component source. The existing public GitHub Pages site is a static site build and does not currently install or compile React components. Adding this source file alone does not mount it on `https://tlce.store/` or activate a live Worker. A React host/build integration and a deployed/configured Worker are separate release steps; do not add browser secrets or claim production activation before those steps are completed.
