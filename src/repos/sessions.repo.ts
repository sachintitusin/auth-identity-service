// src/repos/sessions.repo.ts
import { PoolClient } from 'pg';

export async function terminateSession(
  client: PoolClient,
  params: {
    sessionId: string;
    reason: string;
  }
): Promise<{ identityId: string } | null> {
  const { rows } = await client.query<{
    identity_id: string;
  }>(
    `
    UPDATE sessions
    SET
      terminated_at = now(),
      termination_reason = $2
    WHERE id = $1
      AND terminated_at IS NULL
    RETURNING identity_id
    `,
    [params.sessionId, params.reason]
  );

  if (rows.length === 0) {
    return null;
  }

  return { identityId: rows[0].identity_id };
}

export async function findActiveSessionsForIdentity(
  client: PoolClient,
  identityId: string
): Promise<Array<{ sessionId: string }>> {
  const res = await client.query(
    `
    SELECT id
    FROM sessions
    WHERE identity_id = $1
      AND terminated_at IS NULL
    `,
    [identityId]
  );

  return res.rows.map((row) => ({
    sessionId: row.id,
  }));
}
