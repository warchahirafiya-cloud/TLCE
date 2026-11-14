# Internal Product Modules

All product modules are children of TLCE. They register with the shared Runtime Engine and consume versioned Core contracts; they do not own platform infrastructure.

## Module boundary
- Keep module business logic and module-owned data inside its directory.
- Request only the exact resource/action permissions required.
- Declare dependencies and API compatibility in a manifest.
- Communicate across module boundaries through versioned APIs or events.
- Never import another product module's private implementation.
- Never bundle or fork the Runtime Engine inside a product module.

## QuestPulse
QuestPulse is reserved as the internal module identifier `quest-pulse`. Its existing standalone repository is a technical reference only. No source code is copied into this repository until its code, dependencies, licensing, and API boundaries have been reviewed.

The QuestPulse module is not considered integrated or runnable merely because its directory and documentation exist.
