# TLCE Core

TLCE Core owns cross-module identity, authorization, configuration, audit policy, and stable shared contracts.

## Initial implementation
- `identity/src/authorization.ts`: explicit permission checks with deny-by-default behavior.

## Boundary rules
- Core must not import product-module code.
- Product modules receive only capabilities and permissions explicitly granted to them.
- Never place secrets or credentials in source control.
