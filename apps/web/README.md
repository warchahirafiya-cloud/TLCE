# TLCE Web Shell — QuestPulse

This directory contains the first static browser interface for the internal QuestPulse module.

## Current behavior
- Arabic RTL, responsive, accessible public read-only interface.
- Reads only `data/offers.json`.
- Displays only records marked `published` that pass the client-side safety gate.
- Filters by text, eligible country, and category.
- Escapes untrusted text before rendering.
- Empty catalogue is intentional; no demo offers or fabricated payment claims are inserted.

## Security and product boundaries
- Candidate ingestion is not connected to the public catalogue.
- No login, publisher submission, uploads, moderation, social actions, or account/session handling is enabled.
- No standalone Q.P identity or backend is included.
- Client-side validation is a presentation safeguard, not an authorization boundary. Any future write API must revalidate on the server using the TLCE parent contracts.
- Active product scope excludes cryptocurrency, blockchain, token, mining, and wallet features.
- This shell is not a deployment configuration and is not yet a Release Candidate.

## Local preview
Serve the repository root with any static HTTP server and open `/apps/web/`. ES modules and fetch require HTTP(S), not a `file://` URL.

## Tests
Run `node --test apps/web/test/*.test.mjs` with Node.js 22 or later.
