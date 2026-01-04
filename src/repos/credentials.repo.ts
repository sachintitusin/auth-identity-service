import { PoolClient } from 'pg';
import { randomUUID } from 'crypto';

export async function findActivePasswordCredential(
  client: PoolClient,
  identityId: string
): Promise<{ id: string } | null> {
  const res = await client.query(
    `
    SELECT id
    FROM credentials
    WHERE identity_id = $1
      AND credential_type = 'password'
      AND revoked_at IS NULL
    LIMIT 1
    `,
    [identityId]
  );

  return res.rows[0] ?? null;
}

export async function revokeCredential(
  client: PoolClient,
  credentialId: string
): Promise<void> {
  await client.query(
    `
    UPDATE credentials
    SET revoked_at = now()
    WHERE id = $1
      AND revoked_at IS NULL
    `,
    [credentialId]
  );
}

export async function createPasswordCredential(
  client: PoolClient,
  identityId: string
): Promise<{ credentialId: string }> {
  const credentialId = randomUUID();

  await client.query(
    `
    INSERT INTO credentials (
      id,
      identity_id,
      credential_type
    ) VALUES ($1, $2, 'password')
    `,
    [credentialId, identityId]
  );

  return { credentialId };
}
