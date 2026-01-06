import { PoolClient } from 'pg';
import { findActiveSessionsForIdentity } from '../repos/sessions.repo';
import { terminateSessionAndTokens } from './session-termination.service';
import { SessionTerminationReason } from './session-termination-reason';

/**
 * Terminates all active sessions for a given identity.
 */
export async function terminateIdentitySessions(
  client: PoolClient,
  params: {
    identityId: string;
    reason: SessionTerminationReason;
  }
): Promise<void> {
  // 1. Fetch all active sessions for the identity
  const sessions = await findActiveSessionsForIdentity(
    client,
    params.identityId
  );

  // 2. Terminate each session individually
  for (const { sessionId } of sessions) {
    await terminateSessionAndTokens(client, {
      sessionId,
      reason: params.reason,
    });
  }
}
