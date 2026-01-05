import { PoolClient } from 'pg';
import { randomUUID } from 'crypto';

/**
 * Identity repository.
 *
 * An identity represents the existence of a principal in the system.
 * It is intentionally minimal and independent of:
 *  - credentials
 *  - identifiers (email, phone, etc.)
 *  - OAuth providers
 *  - sessions
 *
 * Identity creation is a pure persistence operation.
 */
export async function createIdentity(
  client: PoolClient
): Promise<{
  id: string;
  subjectId: string;
}> {
  /**
   * Generate internal identifiers.
   *
   * - id:
   *   Primary key used internally for ownership and joins.
   *
   * - subjectId:
   *   Stable, externally visible identifier.
   *   Used as `sub` in access tokens.
   *   Never reused or reassigned.
   */
  const id = randomUUID();
  const subjectId = randomUUID();

  /**
   * Persist identity existence.
   *
   * Note:
   *  - No credentials are attached here
   *  - No identifiers (email) are created
   *  - No sessions are started
   *  - No verification state is implied
   */
  await client.query(
    `
    INSERT INTO identities (id, subject_id)
    VALUES ($1, $2)
    `,
    [id, subjectId]
  );

  return { id, subjectId };
}
