import { Request, Response } from 'express';
import { pool } from '../db';
import { terminateIdentitySessions } from '../domain/identity-session-termination.service';
import { SessionTerminationReason } from '../domain/session-termination-reason';

export async function logoutAllSessions(
  req: Request,
  res: Response
) {
  const subjectId = req.identitySubject; // subject_id from auth context

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 🔑 Resolve internal identity.id
    const identityRes = await client.query(
      `
      SELECT id
      FROM identities
      WHERE subject_id = $1
        AND deleted_at IS NULL
      `,
      [subjectId]
    );

    if (identityRes.rowCount === 0) {
      // Fail closed — but idempotent
      await client.query('COMMIT');
      return res.status(204).send();
    }

    const identityId = identityRes.rows[0].id;

    await terminateIdentitySessions(client, {
      identityId,
      reason: SessionTerminationReason.USER_LOGOUT,
    });

    await client.query('COMMIT');
    return res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
