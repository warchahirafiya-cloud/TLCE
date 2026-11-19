# TLCE STORE Initial Threat Model

## Assets to protect

- Developer accounts and verification records.
- Private submissions, source references, and review evidence.
- Application binaries and signing identity.
- Public catalogue integrity and download availability.
- Reviewer decisions, audit events, and incident records.
- Store visitors' privacy and device security.

## Threat actors and scenarios

| Threat | Example | Required control |
|---|---|---|
| Unapproved publisher | Attacker edits client JSON to mark an app approved. | Server-side authorization; generate public catalogue from trusted release records. |
| Malicious developer | Uploads spyware, credential theft, or a trojanized APK. | Quarantine, static/dynamic scanning, permission review, signer verification, independent release approval. |
| Account takeover | Reviewer credentials are phished. | OIDC, MFA, short sessions, least privilege, sensitive-action reauthentication. |
| Self-approval | Submitter approves and publishes their own app. | Separation of duties and server-enforced actor checks. |
| Supply-chain compromise | Dependency or build pipeline is tampered with. | Pinned actions/dependencies, provenance, SBOM, checksum, protected release workflow. |
| Stored XSS | Product name or description contains HTML/JavaScript. | Context-aware output encoding, restrictive CSP, schema limits, tests. |
| Path traversal | Listing points outside the deployed app root. | Strict allowlisted local entry paths; no arbitrary file paths. |
| Malicious update | Safe first release is replaced by a harmful update. | Every version is a new immutable review/release unit. |
| Artifact substitution | Downloaded APK differs from reviewed binary. | Immutable artifact ID, SHA-256, signing certificate fingerprint, controlled delivery. |
| Denial of service | Submission or report endpoint is flooded. | Rate limiting, quotas, request caps, abuse monitoring. |
| Data leakage | Identity documents or private evidence land in public Git. | Private storage, retention policy, secret scanning, repository exclusion. |

## Current controls in the static phase

- Public listings are filtered by published/reviewed/developer-approved state.
- Listing text is escaped before HTML insertion.
- Product IDs and web launch paths are constrained.
- Duplicate product IDs are suppressed.
- Android binaries and external tool launch links are disabled.
- No upload endpoint, developer account, payment flow, or secrets are present in the static storefront.

## Residual risks and limitations

- Static JSON approval flags are not an authorization boundary. Anyone who can change the public repository can change the catalogue; repository branch protection and trusted review remain essential.
- The static site cannot verify developer identity, perform malware scanning, authenticate reviewers, or revoke already-downloaded files.
- The current catalogue has one first-party QuestPulse entry; it is not a marketplace with external submissions yet.

## Mandatory production gates

1. Threat-model review before backend implementation.
2. Protected branches, required code review, and restricted repository administration.
3. Independent developer, reviewer, and publisher roles.
4. Private artifact quarantine and verified release pipeline.
5. Monitoring, abuse reporting, takedown, rollback, and incident response.
