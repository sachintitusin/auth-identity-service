import { PoolClient } from 'pg';
import { randomUUID } from 'crypto';

/**
 * External identities bind an internal identity
 * to an external provider subject (e.g. Google `sub`).
 *
 * Binding key:
 *   (provider, provider_subject)
 *
 * Email, name, profile data are intentionally ignored.
 */

/**
 * Find an active external identity by provider + subject.
 *
 * Used during OAuth authentication to determine whether
 * this external account has been seen before.
 */
export async function findExternalIdentity(
  client: PoolClient,
  params: {
    provider: string;
    providerSubject: string;
  }
): Promise<{
  id: string;
  identityId: string;
} | null> {
  const result = await client.query(
    `
    SELECT id, identity_id
    FROM external_identities
    WHERE provider = $1
      AND provider_subject = $2
      AND deleted_at IS NULL
    `,
    [params.provider, params.providerSubject]
  );

  // No match → external account has never been linked
  if (result.rowCount === 0) {
    return null;
  }

  // Exactly one row is guaranteed by the partial unique index
  return {
    id: result.rows[0].id,
    identityId: result.rows[0].identity_id,
  };
}

/**
 * Create a new external identity binding.
 *
 * This MUST be called inside a transaction together with
 * identity creation, so that partial state is impossible.
 *
 * The database enforces:
 *  - uniqueness of active (provider, provider_subject)
 *  - referential integrity to identities
 */
export async function createExternalIdentity(
  client: PoolClient,
  params: {
    identityId: string;
    provider: string;
    providerSubject: string;
  }
): Promise<void> {
  await client.query(
    `
    INSERT INTO external_identities (
      id,
      identity_id,
      provider,
      provider_subject
    ) VALUES ($1, $2, $3, $4)
    `,
    [
      randomUUID(),
      params.identityId,
      params.provider,
      params.providerSubject,
    ]
  );
}
