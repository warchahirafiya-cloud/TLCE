# PostgreSQL External Account Links

Status: read-only lookup adapter for explicitly provisioned identity links.

## Behavior

- Resolves only the supported GitHub provider and its stable numeric account ID.
- Maps the provider account ID to an existing TLCE subject.
- Returns inactive links as inactive so the identity resolver can deny them.
- Returns null for unknown provider subjects; it never creates TLCE accounts.
- Does not assign roles, module scopes, MFA status or permissions.

## Provisioning boundary

The migration creates the link table only. It does not insert any operator links.
Link creation, disablement and review must be performed through a separately
authorized administrative workflow with dual-control/audit requirements.
Do not add a public self-service endpoint that lets a user claim an arbitrary
TLCE subject.

Provider OAuth exchange and authenticated-user API verification remain the
responsibility of a trusted GitHub OAuth adapter. Pass only a verified stable
numeric provider account ID to the identity resolver.
