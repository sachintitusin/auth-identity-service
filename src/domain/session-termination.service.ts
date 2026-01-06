import { PoolClient } from 'pg';
import { revokeRefreshTokensForSession } from '../repos/refresh-tokens.repo';
import { terminateSession } from '../repos/sessions.repo';
import { emitAuditEvent } from './audit/audit.service';
import { AuditEventType } from './audit/audit.types';
import { SessionTerminationReason } from './session-termination-reason';

/**
 * Terminates a session and revokes all associated refresh tokens.
 */
export async function terminateSessionAndTokens(
  client: PoolClient,
  params: {
    sessionId: string;
    reason: SessionTerminationReason;
  }
): Promise<void> {
  // 1. Revoke refresh tokens (safe & idempotent)
  await revokeRefreshTokensForSession(client, params.sessionId);

  // 2. Terminate session
  const result = await terminateSession(client, {
    sessionId: params.sessionId,
    reason: params.reason,
  });

  // If session was already terminated, nothing changed → no audit
  if (!result) {
    return;
  }

  // 3. Emit audit event (best effort)
  await emitAuditEvent({
    eventType: AuditEventType.SESSION_TERMINATED,
    actor: {
      type: 'identity',
      id: result.identityId,
    },
    target: {
      type: 'session',
      id: params.sessionId,
    },
    metadata: {
      reason: params.reason,
    },
  });
}
