# TLCE Runtime Configuration

Configuration is parsed from an injected environment map; this module does not read process globals, print values or load secrets itself.

| Variable | Purpose | Required |
|---|---|---|
| TLCE_MODE | development, test, production | No; defaults to development |
| PORT | HTTP listener port | No; defaults to 3000 |
| LOG_LEVEL | debug, info, warn, error | No; defaults by mode |
| DATABASE_URL | PostgreSQL connection URL | Production |
| OIDC_ISSUER | HTTPS identity issuer | Production |
| OIDC_AUDIENCE | TLCE API audience | Production |
| AI_PROVIDER | Provider adapter identifier | Production |
| AI_API_KEY | Provider credential | Production |

Production configuration fails closed unless database, OIDC and AI settings are present and internally consistent. Supply secrets at runtime from a managed secret store; never commit environment files or real credentials.

This validates configuration shape only. It does not connect to PostgreSQL, verify an OIDC issuer, test an AI credential, or start an HTTP listener.
