# Runtime security guarantees

- Access JWTs are verified cryptographically before the protected search operation.
- Search is unavailable when identity verification or rate limiting cannot be completed.
- Search result URLs are restricted by the provider adapter to HTTPS.
- Provider errors are reduced to generic client-facing responses.
- The Worker does not accept API keys or credentials from browser requests.
