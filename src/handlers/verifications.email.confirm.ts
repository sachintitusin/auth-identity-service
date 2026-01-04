import { Request, Response } from 'express';
import { pool } from '../db';
import { confirmEmailVerification } from '../domain/email-verification';

export async function confirmEmailVerificationHandler(
  req: Request,
  res: Response
) {
  const { token } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await confirmEmailVerification(client, { rawToken: token });

    await client.query('COMMIT');

    /**
     * Always return 204:
     * - valid token
     * - invalid token
     * - expired token
     * - reused token
     *
     * No observable difference.
     */
    return res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
