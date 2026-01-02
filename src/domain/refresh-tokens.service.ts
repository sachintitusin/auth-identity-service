import { pool } from '../db';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  findRefreshTokenByHash,
  markRefreshTokenUsed,
  createRefreshToken,
  revokeSessionAndTokens,
  updateSessionTokenIssuedAt,
} from '../repos/refresh-tokens.repo';

const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function hashRefreshToken(rawToken: string): Buffer {
  return crypto.createHash('sha256').update(rawToken).digest();
}

function generateOpaqueRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export async function refreshSessionTokens(rawRefreshToken: string) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const hashedToken = hashRefreshToken(rawRefreshToken);

    const tokenRecord = await findRefreshTokenByHash(client, hashedToken);

    // Missing token → fail closed
    if (!tokenRecord) {
      throw new Error('AUTHENTICATION_FAILED');
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
      replaced_by_token_id ||
      expires_at <= now
    ) {
      // Enforce INV-TOKEN-3
      await revokeSessionAndTokens(client, sessionId);
      throw new Error('AUTHENTICATION_FAILED');
    }

    // --- Rotate refresh token ---
    const newRefreshTokenId = uuidv4();
    const newRawRefreshToken = generateOpaqueRefreshToken();
    const newHashedToken = hashRefreshToken(newRawRefreshToken);
    const newExpiresAt = new Date(
      now.getTime() + REFRESH_TOKEN_TTL_MS
    );

    await createRefreshToken(client, {
      id: newRefreshTokenId,
      sessionId,
      hashedToken: newHashedToken,
      expiresAt: newExpiresAt,
    });

    await markRefreshTokenUsed(
      client,
      refreshTokenId,
      newRefreshTokenId
    );

    await updateSessionTokenIssuedAt(client, sessionId);

    await client.query('COMMIT');

    return {
      sessionId,
      refreshToken: newRawRefreshToken,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
