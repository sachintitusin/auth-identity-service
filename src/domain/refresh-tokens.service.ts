import { pool } from '../db';
import { createHash } from 'crypto';

import {
  findRefreshTokenByHash,
  createRefreshToken,
  updateSessionTokenIssuedAt,
} from '../repos/refresh-tokens.repo';

import { AuthenticationFailedError } from '../errors';
import { SessionTerminationReason } from './session-termination-reason';
import { terminateSessionAndTokens } from './session-termination.service';

import { emitAuditEvent } from './audit/audit.service';
import { AuditEventType } from './audit/audit.types';

function hashRefreshToken(rawToken: string): Buffer {
  return createHash('sha256').update(rawToken).digest();
}

/**
 * Refresh session tokens using a single-use refresh token.
 *
 * Semantics:
 * - Missing token → auth failure (no audit)
 * - Used / revoked / expired token → security event + session termination
 * - Valid token → rotate + audit
 */
export async function refreshSessionTokens(rawRefreshToken: string) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const hashedToken = hashRefreshToken(rawRefreshToken);

    const tokenRecord = await findRefreshTokenByHash(client, hashedToken);

    // Missing token → authentication failure (no state change)
    if (!tokenRecord) {
      throw new AuthenticationFailedError();
    }

    const {
      id: refreshTokenId,
      session_id: sessionId,
      used_at,
      revoked_at,
      expires_at,
      identity_subject,
    } = tokenRecord;

    const now = new Date();

    // ---- Reuse / invalid token (security event) ----
    if (used_at || revoked_at || expires_at <= now) {
      await terminateSessionAndTokens(client, {
        sessionId,
        reason: SessionTerminationReason.TOKEN_REUSE,
      });

      await emitAuditEvent({
        eventType: AuditEventType.REFRESH_TOKEN_REUSE_DETECTED,
        actor: {
          type: 'system',
          id: null,
        },
        target: {
          type: 'session',
          id: sessionId,
        },
        metadata: {
          reason: used_at
            ? 'used_token'
            : revoked_at
            ? 'revoked_token'
            : 'expired_token',
        },
      });

      await client.query('COMMIT');
      throw new AuthenticationFailedError();
    }

    // ---- Valid token → rotate ----
    const { rawRefreshToken: newRawRefreshToken } =
      await createRefreshToken(client, {
        sessionId,
        replacesTokenId: refreshTokenId,
      });

    await updateSessionTokenIssuedAt(client, sessionId);

    await emitAuditEvent({
      eventType: AuditEventType.REFRESH_TOKEN_ROTATED,
      actor: {
        type: 'identity',
        id: identity_subject,
      },
      target: {
        type: 'session',
        id: sessionId,
      },
    });

    await client.query('COMMIT');

    return {
      sessionId,
      identitySubject: identity_subject,
      refreshToken: newRawRefreshToken,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
