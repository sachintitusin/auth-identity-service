// src/sessions.logout.ts
import { Request, Response } from 'express';
import { pool } from './db';
import { revokeSessionAndTokens } from './repos/refresh-tokens.repo';
import { SessionTerminationReason } from './domain/session-termination-reason';
import { UnauthorizedError } from './errors';

export async function logoutCurrentSession(req: Request, res: Response) {

    if (!(req as any).sessionId) {
        throw new UnauthorizedError("AUTHENTICATION_FAILED");
    }
  // sessionId must come from authenticated context
  const sessionId = (req as any).sessionId;


  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // the current session gets marked as revoked
    // associated tokens get revoked
    await revokeSessionAndTokens(
      client,
      sessionId,
      SessionTerminationReason.USER_LOGOUT
    );

    await client.query('COMMIT');

    // Clear refresh token cookie (best effort)
    res.clearCookie('refresh_token', {
      path: '/tokens/refresh',
    });

    return res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
