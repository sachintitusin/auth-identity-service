// src/sessions.logout.ts
import { Request, Response } from 'express';
import { pool } from '../db';
import { terminateSessionAndTokens } from '../domain/session-termination.service';
import { SessionTerminationReason } from '../domain/session-termination-reason';
import { UnauthorizedError } from '../errors';

export async function logoutCurrentSession(req: Request, res: Response) {
  if (!req.sessionIdentifier) {
    throw new UnauthorizedError();
  }

  // sessionId must come from authenticated context
  const sessionId = req.sessionIdentifier;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await terminateSessionAndTokens(client, {
      sessionId,
      reason: SessionTerminationReason.USER_LOGOUT,
    });

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
