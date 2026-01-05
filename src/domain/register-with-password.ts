// src/domain/registration/register-with-password.ts

import { PoolClient } from 'pg';
import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcrypt';

import { createIdentity } from '../repos/identities.repo';

export async function registerWithPassword(
  client: PoolClient,
  params: {
    email: string;
    password: string;
  }
): Promise<{
  identityId: string;
  verification: {
    rawToken: string;
    expiresAt: Date;
  };
}> {
  // ---- 1. Create identity ----
  const identity = await createIdentity(client);

  // ---- 2. Create email identifier (unverified) ----
  const identifierId = crypto.randomUUID();

  await client.query(
    `
    INSERT INTO identity_identifiers (
      id,
      identity_id,
      type,
      value,
      verified_at
    ) VALUES ($1, $2, 'email', $3, NULL)
    `,
    [identifierId, identity.id, params.email]
  );

  // ---- 3. Create password credential ----
  const credentialId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(params.password, 12);

  await client.query(
    `
    INSERT INTO credentials (
      id,
      identity_id,
      credential_type
    ) VALUES ($1, $2, 'password')
    `,
    [credentialId, identity.id]
  );

  await client.query(
    `
    INSERT INTO password_credentials (
      credential_id,
      identifier_id,
      password_hash,
      hash_algorithm
    ) VALUES ($1, $2, $3, 'bcrypt')
    `,
    [credentialId, identifierId, passwordHash]
  );

  // ---- 4. Create email verification ----
  const rawToken = randomBytes(32).toString('base64url');
  const hashedToken = createHash('sha256').update(rawToken).digest();

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await client.query(
    `
    INSERT INTO verifications (
      id,
      identity_id,
      verification_type,
      hashed_token,
      expires_at
    ) VALUES ($1, $2, 'email', $3, $4)
    `,
    [crypto.randomUUID(), identity.id, hashedToken, expiresAt]
  );

  return {
    identityId: identity.id,
    verification: {
      rawToken,
      expiresAt,
    },
  };
}
