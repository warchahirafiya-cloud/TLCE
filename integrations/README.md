# Integrations workspace

This directory is the TLCE-owned home for external provider catalogue data and future adapters.

- `catalog/providers.json`: provider identity, official URL, category, evaluation state and risk class.
- Future adapters must live behind TLCE Core authorization and must not be imported directly by QuestPulse.
- No credentials, access tokens, refresh tokens, API keys or customer data belong in this directory.

See [Integration Control Plane](../docs/INTEGRATION_CONTROL_PLANE.md) and [Integration Catalogue](../docs/INTEGRATION_CATALOG.md).
