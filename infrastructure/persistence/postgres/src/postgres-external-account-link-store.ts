import type {
  ExternalAccountLinkStore,
  ExternalIdentityProvider,
  LinkedExternalAccount,
} from "../../../../core/identity/src/external-identity.js";
import type { PostgresQueryExecutor } from "./postgres-operator-session-store.js";

interface ExternalLinkRow extends Record<string, unknown> {
  tlce_subject: unknown;
  active: unknown;
}

/**
 * Read-only lookup adapter for pre-provisioned external identity links.
 * Link creation/activation is deliberately excluded from the sign-in path.
 */
export class PostgresExternalAccountLinkStore implements ExternalAccountLinkStore {
  constructor(private readonly database: PostgresQueryExecutor) {}

  async findLink(
    provider: ExternalIdentityProvider,
    providerSubject: string,
  ): Promise<LinkedExternalAccount | null> {
    if (provider !== "github" || !/^[0-9]{1,32}$/.test(providerSubject)) return null;

    const result = await this.database.query<ExternalLinkRow>(
      `SELECT tlce_subject, active
       FROM tlce_external_account_links
       WHERE provider = $1 AND provider_subject = $2
       LIMIT 1`,
      [provider, providerSubject],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (typeof row.tlce_subject !== "string" ||
        !/^[A-Za-z0-9._:@-]{1,200}$/.test(row.tlce_subject) ||
        typeof row.active !== "boolean") {
      throw new Error("Invalid persisted external account link");
    }
    return Object.freeze({ tlceSubject: row.tlce_subject, active: row.active });
  }
}
