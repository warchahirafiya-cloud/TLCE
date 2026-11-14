# QuestPulse Source Inventory and Scope Reconciliation

Date: 2026-11-14
Parent platform: The Last Cosmic Explosion (TLCE)
Target: internal module `modules/questpulse`
Status: initial source inventory; no legacy feature migration performed.

## Source material reviewed

The following preserved HTML artifacts were available in the project Library and were read as reference material. They are not assumed to be a single consistent release.

| Artifact | Observed product intent | Observable features | Confidence / caveat |
|---|---|---|---|
| `QuestPulse-index.html` | Arabic Web3 rewards and opportunity directory | Airdrop directory sections, Telegram bots, referral rewards, apps, search/type filters, bot status/reset filters, opportunity cards, task completion stored in localStorage, safety guidance | UI prototype; bot/opportunity datasets are empty placeholders. No verified provider records or backend API are present in the reviewed source. |
| `questpulse_timer_update.html` | Web3 rewards directory with mining timer enhancements | Telegram bot duration in minutes (1–1440), compatibility mapping for legacy reset labels, bot search/filter/status, opportunity sections and local UI behavior | Prototype update; dataset remains empty in the inspected source excerpt. Do not treat sample timer comments as verified bot schedules. |
| `QuestPulse-UI-redesign.html` | Security-awareness product | Client-side URL structure scanner, suspicious scheme rejection, HTTP warning, credential-in-URL warning, Punycode/IP/shortener/long-label/encoded-string/unusual-port/bidi-character heuristics, explanatory findings and safety advice | Separate visual/product direction. Scanner is explicitly local and limited; no live reputation, DNS, TLS, phishing-feed or remote threat-intelligence lookup. |
| `QuestPulse-vNext-security-scanner.html` | Security scanner / awareness direction | Security scanner page and educational guidance; appears related to the redesign | Prototype reference; requires full version-to-version diff before treating as canonical. |

## Important scope conflict

The preserved sources describe at least two materially different product directions:

1. **Web3 opportunity directory:** airdrops, Telegram bots, referral programs, reward apps and safety/risk education.
2. **Security-awareness scanner:** inspect URL structure and explain suspicious patterns before a user opens a link.

These directions may coexist as separate internal capabilities under QuestPulse, but that is an architectural/product decision, not something the scaffold should silently assume. The security redesign may represent a repositioning rather than an additional feature. The current evidence does not establish which direction is canonical, whether both are intended, or whether the Web3 directory is to remain active.

## Initial traceability map

| Legacy surface / behavior | Proposed TLCE boundary | Migration status | Notes |
|---|---|---|---|
| Web3 opportunity catalog | QuestPulse opportunity/catalog service (proposed) | NOT STARTED | Needs canonical data schema, provenance, source links, verification timestamps and moderation policy. |
| Airdrop / campaign cards | Opportunity domain model (proposed) | NOT STARTED | No real campaign dataset was present in reviewed prototype. |
| Telegram bot directory and reset filters | Bot directory/read model (proposed) | NOT STARTED | Empty placeholder list; reset duration is display metadata, not proof of an active mining cycle. |
| Referral and reward-app sections | Opportunity categories (proposed) | NOT STARTED | UI copy only; payout evidence, availability and terms must be modeled as dated claims. |
| Task completion checkboxes | User progress capability (proposed) | NOT STARTED | Prototype uses browser localStorage. No identity, sync, retention or privacy model exists. |
| URL structure scanner | Security scan use case (proposed) | NOT STARTED | Existing heuristic behavior should be ported only with unit tests and explicit limitations. |
| Scanner findings/advice | Versioned scan result contract (proposed) | NOT STARTED | Must distinguish heuristic indicators from reputation verdicts; never label a URL safe based only on absent indicators. |

## Security and data handling observations

- The reviewed scanner parses the URL locally in the browser and does not fetch or open the submitted destination.
- Its output is heuristic only. It does not query domain reputation, DNS, TLS certificate state, phishing feeds or malware intelligence.
- Any future server-side URL enrichment must be designed against SSRF, DNS rebinding, redirects to private/internal addresses, response-size limits, timeouts and data minimization.
- Opportunity/bot cards must not display unverified payment claims, guaranteed earnings, token value forecasts or fabricated availability.
- External links require strict HTTPS allowlisting/validation and safe new-window attributes.
- User progress data must not be migrated from localStorage into a server account until identity, consent, retention and deletion behavior are specified.

## Decisions and gates before implementation

1. Confirm whether QuestPulse includes both the Web3 directory and the security scanner, or whether the scanner replaces the directory.
2. Identify the authoritative source/version for each feature and any additional original source archive required for full parity.
3. Define canonical schemas and source-of-truth rules before implementing persistence or external integrations.
4. Add unit tests for every migrated URL heuristic and every catalog filter/validation rule.
5. Keep the module at zero permissions until specific capabilities are approved.
6. Preserve the original `app.asar` unchanged; any unpacking, editing or repackaging requires separate explicit approval.

## Current conclusion

The source review supports an initial functional inventory, but not a complete legacy route/schema map. No product feature has been claimed as migrated. The next safe engineering increment is to define versioned, permission-free domain contracts for the confirmed scope, then add behavior-specific tests before connecting storage, network access or external providers.
