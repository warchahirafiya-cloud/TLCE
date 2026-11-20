# The Last Cosmic Explosion (TLCE)

TLCE is the parent platform for a modular, hierarchical application ecosystem. Its runtime engine is an independent platform layer; QuestPulse (Q.P) is an internal product branch/module, not a separate parent application.

Architecture and implementation work is maintained on dedicated feature branches. Start here:
- [Architecture](docs/ARCHITECTURE.md)
- [Build status](docs/BUILD_STATUS.md)
- [Implementation roadmap](docs/IMPLEMENTATION_ROADMAP.md)
- [QuestPulse integration contract](docs/QUESTPULSE_INTEGRATION.md)
- [Advanced serverless and edge design](docs/ADVANCED_SERVERLESS_EDGE.md)

The current feature branch includes a TLCE parent browser shell, a browser-buildable runtime, and a route composition root that mounts QuestPulse at `/questpulse`. The Pages workflow is prepared to publish the parent at `/` and the Q.P frontend under `/web/`; this remains an engineering change until reviewed and merged. See the build status and integration contract for verified capabilities and outstanding gates.
