import { Request, Response } from 'express';
import { pool } from '../db';
import { rotatePasswordForSubject } from '../domain/password-rotation.service';
import { AuthenticationFailedError, UnauthorizedError } from '../errors';

export async function changePassword(req: Request, res: Response) {
  const identitySubject = req.identitySubject;

    if (!identitySubject) {
    throw new UnauthorizedError();
    }

  const { current_password, new_password } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await rotatePasswordForSubject(client, {
      identitySubject,
      currentPassword: current_password,
      newPassword: new_password,
    });

    await client.query('COMMIT');
    res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK');

    // Domain already collapsed failures correctly
    if (err instanceof AuthenticationFailedError) {
      throw err;
    }

    throw err; // let global error handler deal with it
  } finally {
    client.release();
  }
}
