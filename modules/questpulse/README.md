# QuestPulse (Q.P) — Internal TLCE Module

QuestPulse is an internal product module of The Last Cosmic Explosion (TLCE). It is not a separate parent application and must not own or duplicate the shared Runtime Engine.

## Integration rules
- Register through the TLCE module manifest and Runtime Engine contracts.
- Request only the permissions required for documented features.
- Do not import implementation details from other product modules.
- Keep module-specific data and business logic inside this directory.
- Use versioned TLCE Core APIs and shared event contracts.
- Do not copy the independent Runtime Engine into this module.

The existing QuestPulse repository remains a separate technical reference until its code is deliberately reviewed and integrated. No Q.P source has been copied or modified by this scaffold.
