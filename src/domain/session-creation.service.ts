import { PoolClient } from 'pg';
import { randomUUID } from 'crypto';
import { createRefreshToken } from '../repos/refresh-tokens.repo';

/**
 * Create a new authenticated session and issue
 * the initial refresh token.
 *
 * This function MUST be called inside an existing transaction.
 *
 * It composes:
 *  - session persistence (sessions table)
 *  - refresh token issuance (refresh-tokens repo)
 *
 * It deliberately does NOT:
 *  - issue access tokens
 *  - handle cookies or HTTP
 *  - perform authorization
 */
export async function createSessionWithRefreshToken(
  client: PoolClient,
  params: {
    identityId: string;
  }
): Promise<{
  sessionId: string;
  sessionIdentifier: string;
  refreshToken: string;
}> {
  /**
   * Internal identifiers:
   *
   * - sessionId:
   *   Primary key for the session row.
   *
   * - sessionIdentifier:
   *   Public, stable identifier safe to expose
   *   to frontend and embed in tokens.
   */
  const sessionId = randomUUID();
  const sessionIdentifier = randomUUID();

  // ---- 1. Create session row ----
  await client.query(
    `
    INSERT INTO sessions (
      id,
      identity_id,
      session_identifier
    ) VALUES ($1, $2, $3)
    `,
    [sessionId, params.identityId, sessionIdentifier]
  );

  // ---- 2. Issue initial refresh token ----
  const { rawRefreshToken } = await createRefreshToken(client, {
    sessionId,
  });

  return {
    sessionId,
    sessionIdentifier,
    refreshToken: rawRefreshToken,
  };
}
