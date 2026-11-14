# OAuth implementation contract

The integration core now includes authorization-start primitives using authorization-code + PKCE S256, per-attempt cryptographically random state/verifier values, bounded transaction expiry, HTTPS-only authorization/redirect URLs, and one-time callback-state consumption through a storage port.

Security baseline: IETF RFC 9700 (OAuth 2.0 Security Best Current Practice, January 2025). It requires PKCE for public clients, recommends PKCE for confidential clients, requires transaction-specific binding, and recommends exact redirect URI matching. Reference: https://www.rfc-editor.org/rfc/rfc9700.html

## Deliberate boundary
This is a protocol primitive, not a complete provider connection. It does not exchange authorization codes, validate provider identity/issuer, store tokens, create OAuth clients, or connect any owner account.

## Production adapters still required
- Durable, atomic, distributed transaction store with TTL and encryption for PKCE verifier material.
- Provider-specific authorization/token endpoint metadata and exact registered redirect URI allowlists.
- Server-only token exchange with client authentication where required; no secrets in browser code.
- Issuer/mix-up validation, audience/resource validation, callback error handling and strict state binding to authenticated user + tenant + browser session.
- Secret vault with envelope encryption, rotation, revocation and audited access.
- Refresh-token rotation or sender-constrained token support where the provider supports it.
- CSRF/session protections, rate limiting, abuse detection, secure cookies and callback origin validation.
- Integration tests against provider sandbox environments and security review.

Do not expose this module as a public endpoint until the above production gates are complete. No real OAuth flow or third-party connection has been initiated by adding these files.
