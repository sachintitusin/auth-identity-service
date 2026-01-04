import { PoolClient } from 'pg';

/**
 * Load password hash and algorithm for an active password credential.
 * Caller is responsible for ensuring the credential is valid and active.
 */
export async function findPasswordCredentialSecret(
  client: PoolClient,
  credentialId: string
): Promise<{
  passwordHash: string;
  hashAlgorithm: string;
  identifierId: string;
} | null> {
  const res = await client.query(
    `
    SELECT
      password_hash,
      hash_algorithm,
      identifier_id
    FROM password_credentials
    WHERE credential_id = $1
    `,
    [credentialId]
  );

  if (res.rows.length === 0) {
    return null;
  }

  return {
    passwordHash: res.rows[0].password_hash,
    hashAlgorithm: res.rows[0].hash_algorithm,
    identifierId: res.rows[0].identifier_id,
  };
}

/**
 * Create a password credential implementation for a credential.
 * Assumes credential existence and validity are enforced by caller.
 */
export async function createPasswordCredentialSecret(
  client: PoolClient,
  params: {
    credentialId: string;
    identifierId: string;
    passwordHash: string;
    hashAlgorithm: string;
  }
): Promise<void> {
  await client.query(
    `
    INSERT INTO password_credentials (
      credential_id,
      identifier_id,
      password_hash,
      hash_algorithm
    ) VALUES ($1, $2, $3, $4)
    `,
    [
      params.credentialId,
      params.identifierId,
      params.passwordHash,
      params.hashAlgorithm,
    ]
  );
}
