import { PoolClient } from 'pg';

/**
 * Find an identity identifier by type and value.
 * Used for silent resolution (no existence guarantees).
 */
export async function findIdentityIdentifier(
  client: PoolClient,
  params: {
    type: 'email';
    value: string;
  }
) {
  const res = await client.query(
    `
    SELECT
      ii.id,
      ii.identity_id,
      ii.type,
      ii.value,
      ii.verified_at
    FROM identity_identifiers ii
    WHERE ii.type = $1
      AND ii.value = $2
    LIMIT 1
    `,
    [params.type, params.value]
  );

  return res.rows[0] ?? null;
}

/**
 * Mark an identity identifier as verified.
 * Safe to call multiple times (idempotent).
 */
export async function markIdentifierVerified(
  client: PoolClient,
  identifierId: string
) {
  await client.query(
    `
    UPDATE identity_identifiers
    SET verified_at = now()
    WHERE id = $1
      AND verified_at IS NULL
    `,
    [identifierId]
  );
}

/**
 * Fetch an identity identifier by identity + type.
 * Used during verification confirmation.
 */
export async function findIdentifierByIdentityAndType(
  client: PoolClient,
  params: {
    identityId: string;
    type: 'email';
  }
) {
  const res = await client.query(
    `
    SELECT
      ii.id,
      ii.identity_id,
      ii.type,
      ii.value,
      ii.verified_at
    FROM identity_identifiers ii
    WHERE ii.identity_id = $1
      AND ii.type = $2
    LIMIT 1
    `,
    [params.identityId, params.type]
  );

  return res.rows[0] ?? null;
}
