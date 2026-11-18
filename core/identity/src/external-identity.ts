/**
 * Maps a provider-verified external account to an existing TLCE subject.
 *
 * Provider adapters must verify the authorization response server-side and fetch
 * the provider's stable account identifier. Display names and usernames are
 * deliberately excluded from the identity key.
 */
export type ExternalIdentityProvider = "github";

export interface VerifiedExternalIdentity {
  readonly provider: ExternalIdentityProvider;
  /** Stable provider account ID, serialized as a decimal string. Never a username. */
  readonly providerSubject: string;
  /** Timestamp at which the provider identity was verified server-side. */
  readonly verifiedAt: string;
}

export interface LinkedExternalAccount {
  readonly tlceSubject: string;
  readonly active: boolean;
}

export interface ExternalAccountLinkStore {
  findLink(provider: ExternalIdentityProvider, providerSubject: string): Promise<LinkedExternalAccount | null>;
}

export class ExternalIdentityNotLinkedError extends Error {
  constructor() {
    super("External account is not linked to a TLCE identity");
    this.name = "ExternalIdentityNotLinkedError";
  }
}

export class ExternalIdentityDisabledError extends Error {
  constructor() {
    super("External account link is disabled");
    this.name = "ExternalIdentityDisabledError";
  }
}

/**
 * Resolve only pre-linked accounts. This function never creates a TLCE user,
 * assigns roles, or trusts profile fields supplied by the browser.
 */
export async function resolveLinkedExternalIdentity(
  identity: VerifiedExternalIdentity,
  links: ExternalAccountLinkStore,
): Promise<{ readonly subject: string }> {
  if (identity.provider !== "github" ||
      !/^[0-9]{1,32}$/.test(identity.providerSubject) ||
      !Number.isFinite(Date.parse(identity.verifiedAt))) {
    throw new Error("Invalid verified external identity");
  }

  const link = await links.findLink(identity.provider, identity.providerSubject);
  if (!link) throw new ExternalIdentityNotLinkedError();
  if (!link.active) throw new ExternalIdentityDisabledError();
  if (!link.tlceSubject || link.tlceSubject.trim() !== link.tlceSubject) {
    throw new Error("Invalid TLCE subject mapping");
  }

  return Object.freeze({ subject: link.tlceSubject });
}
