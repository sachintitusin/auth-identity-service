import { PoolClient } from 'pg';
import { randomUUID, randomBytes, createHash } from 'crypto';

/**
 * Fetch refresh token record by hashed token.
 * No validation or interpretation here.
 */
export async function findRefreshTokenByHash(
  client: PoolClient,
  hashedToken: Buffer
) {
  const res = await client.query(
    `
    SELECT
      rt.id,
      rt.session_id,
      rt.used_at,
      rt.revoked_at,
      rt.expires_at,
      rt.replaced_by_token_id,
      i.subject_id AS identity_subject
    FROM refresh_tokens rt
    JOIN sessions s ON s.id = rt.session_id
    JOIN identities i ON i.id = s.identity_id
    WHERE rt.hashed_token = $1
    LIMIT 1
    `,
    [hashedToken]
  );

  return res.rows[0] ?? null;
}

/**
 * Mark a refresh token as used and link it to its successor.
 */
export async function markRefreshTokenUsed(
  client: PoolClient,
  refreshTokenId: string,
  replacedByTokenId: string
) {
  await client.query(
    `
    UPDATE refresh_tokens
    SET
      used_at = now(),
      replaced_by_token_id = $2
    WHERE id = $1
    `,
    [refreshTokenId, replacedByTokenId]
  );
}

/**
 * Create a new refresh token for a session.
 */
export async function createRefreshToken(
  client: PoolClient,
  params: {
    sessionId: string;
    replacesTokenId?: string;
  }
): Promise<{ rawRefreshToken: string }> {
  const rawRefreshToken = randomBytes(32).toString('base64url');

  const hashedToken = createHash('sha256')
    .update(rawRefreshToken)
    .digest();

  const refreshTokenId = randomUUID();

  await client.query(
    `
    INSERT INTO refresh_tokens (
      id,
      session_id,
      hashed_token,
      expires_at
    ) VALUES ($1, $2, $3, now() + interval '30 days')
    `,
    [refreshTokenId, params.sessionId, hashedToken]
  );

  if (params.replacesTokenId) {
    await client.query(
      `
      UPDATE refresh_tokens
      SET
        used_at = now(),
        replaced_by_token_id = $2
      WHERE id = $1
      `,
      [params.replacesTokenId, refreshTokenId]
    );
  }

  return { rawRefreshToken };
}

/**
 * Revoke an entire session and all associated refresh tokens.
 * Used for logout and token-reuse security events.
 */
export async function revokeSessionAndTokens(
  client: PoolClient,
  sessionId: string
) {
  await client.query(
    `
    UPDATE refresh_tokens
    SET revoked_at = now()
    WHERE session_id = $1
      AND revoked_at IS NULL
    `,
    [sessionId]
  );

  await client.query(
    `
    UPDATE sessions
    SET
      terminated_at = now(),
      termination_reason = 'TOKEN_REUSE'
    WHERE id = $1
      AND terminated_at IS NULL
    `,
    [sessionId]
  );
}

/**
 * Observational only — never used for authorization.
 */
export async function updateSessionTokenIssuedAt(
  client: PoolClient,
  sessionId: string
) {
  await client.query(
    `
    UPDATE sessions
    SET last_token_issued_at = now()
    WHERE id = $1
    `,
    [sessionId]
  );
}
