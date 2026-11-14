# TLCE Shared UI Component Foundation

Framework-neutral component contracts and design tokens for the parent shell and internal product frontends.

- Components declare semantic version, API version, keyboard operation, semantic root and accessible-name requirements.
- The registry rejects invalid, inaccessible, duplicate or externally hosted style declarations.
- Shared tokens are CSS custom properties prefixed with `--tlce-`.
- Product-specific composition stays inside its micro-frontend; only genuinely reusable primitives belong here.
- Prefer CSS Modules or Shadow DOM for component styles. Global tokens are the only intentional shared CSS surface.

This is a contract and token foundation, not a full component library or visual framework. Add concrete primitives only when they have usage, accessibility and visual regression tests.
