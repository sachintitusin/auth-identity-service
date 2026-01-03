import { pool } from '../db';
import { randomBytes, createHash } from 'crypto';
import {
  findRefreshTokenByHash,
  createRefreshToken,
  revokeSessionAndTokens,
  updateSessionTokenIssuedAt,
} from '../repos/refresh-tokens.repo';
import { AuthenticationFailedError } from '../errors';
import { SessionTerminationReason } from './session-termination-reason';



function hashRefreshToken(rawToken: string): Buffer {
  return createHash('sha256').update(rawToken).digest();
}

export async function refreshSessionTokens(rawRefreshToken: string) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const hashedToken = hashRefreshToken(rawRefreshToken);

    const tokenRecord = await findRefreshTokenByHash(client, hashedToken);

    // Missing token → authentication failure
    if (!tokenRecord) {
      throw new AuthenticationFailedError();
    }

    const {
      id: refreshTokenId,
      session_id: sessionId,
      used_at,
      revoked_at,
      expires_at,
      replaced_by_token_id,
    } = tokenRecord;

    const now = new Date();

    // --- Reuse / invalidation detection (security event) ---
    if (
      revoked_at ||
      used_at ||
      expires_at <= now
    ) {
      // Enforce INV-TOKEN-3
      await revokeSessionAndTokens(client, sessionId, SessionTerminationReason.TOKEN_REUSE);
      await client.query('COMMIT');
      throw new AuthenticationFailedError();
    }

    const { rawRefreshToken: newRawRefreshToken } =
      await createRefreshToken(client, {
        sessionId,
        replacesTokenId: refreshTokenId,
      });

    await updateSessionTokenIssuedAt(client, sessionId);

    await client.query('COMMIT');

    return {
      sessionId,
      identitySubject: tokenRecord.identity_subject, // see note below
      refreshToken: newRawRefreshToken,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
