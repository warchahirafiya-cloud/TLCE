# OAuth Transaction State

Status: one-time OAuth state service and PostgreSQL store; provider callback is not yet implemented.

## Security behavior

- Generates 256-bit URL-safe random state values.
- Persists only SHA-256 state digests.
- Limits transaction lifetime to 30 seconds–15 minutes (default 5 minutes).
- Binds each state to the GitHub provider and an exact HTTPS callback URL.
- Consumes state atomically using PostgreSQL DELETE ... RETURNING, preventing replay across application instances.
- Rejects unknown, expired, malformed, provider-mismatched and callback-mismatched transactions.

## Remaining provider integration

A trusted GitHub OAuth adapter must still validate the callback parameters, consume state exactly once, exchange the authorization code server-side, call GitHub's authenticated user API, validate the stable numeric account ID, resolve the pre-provisioned TLCE external-account link, and then create a TLCE session from server-side policy. OAuth client credentials must be supplied only through managed runtime secrets.

This state component does not implement PKCE, token exchange, provider API verification, MFA, account linking administration or HTTP callback routing. Do not represent it as a complete login flow.
