import { PoolClient } from 'pg';

/**
 * Create a new email verification record.
 * Assumes any existing active verification has already been invalidated.
 */
export async function createEmailVerification(
  client: PoolClient,
  params: {
    verificationId: string;
    identityId: string;
    verificationType: 'email';
    hashedToken: Buffer;
    expiresAt: Date;
  }
) {
  await client.query(
    `
    INSERT INTO verifications (
      id,
      identity_id,
      verification_type,
      hashed_token,
      expires_at
    ) VALUES ($1, $2, $3, $4, $5)
    `,
    [
      params.verificationId,
      params.identityId,
      params.verificationType,
      params.hashedToken,
      params.expiresAt,
    ]
  );
}

/**
 * Invalidate any active verification for an identity + type.
 * Safe to call even if no active verification exists.
 */
export async function invalidateActiveVerification(
  client: PoolClient,
  params: {
    identityId: string;
    verificationType: 'email';
  }
) {
  await client.query(
    `
    UPDATE verifications
    SET invalidated_at = now()
    WHERE identity_id = $1
      AND verification_type = $2
      AND used_at IS NULL
      AND invalidated_at IS NULL
    `,
    [params.identityId, params.verificationType]
  );
}

/**
 * Find a verification record by hashed token.
 * Row is locked to prevent concurrent consumption.
 */
export async function findVerificationByHashedToken(
  client: PoolClient,
  hashedToken: Buffer
) {
  const res = await client.query(
    `
    SELECT
      v.id,
      v.identity_id,
      v.verification_type,
      v.used_at,
      v.invalidated_at,
      v.expires_at
    FROM verifications v
    WHERE v.hashed_token = $1
    FOR UPDATE
    LIMIT 1
    `,
    [hashedToken]
  );

  return res.rows[0] ?? null;
}

/**
 * Mark a verification as used.
 * No-op if already used or invalidated (guarded by domain logic).
 */
export async function markVerificationUsed(
  client: PoolClient,
  verificationId: string
) {
  await client.query(
    `
    UPDATE verifications
    SET used_at = now()
    WHERE id = $1
      AND used_at IS NULL
      AND invalidated_at IS NULL
    `,
    [verificationId]
  );
}
