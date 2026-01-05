import { pool } from '../db';
import { Request, Response } from 'express';
import { RegistrationFailedError } from '../errors';
import { getEmailService } from '../infra/email';
import { registerWithPassword } from '../domain/register-with-password';

export async function register(req: Request, res: Response) {
  const { email, password } = req.body;

  const client = await pool.connect();

  let verification:
    | {
        rawToken: string;
        expiresAt: Date;
      }
    | null = null;

  try {
    await client.query('BEGIN');

    const result = await registerWithPassword(client, {
      email,
      password,
    });

    verification = result.verification;

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw new RegistrationFailedError();
  } finally {
    client.release();
  }

  // ---- SIDE EFFECT (after commit) ----
  if (verification) {
    const emailService = getEmailService();

    emailService
      .sendVerificationEmail({
        to: email,
        verificationLink: `${process.env.FRONTEND_BASE_URL}/verify-email?token=${verification.rawToken}`,
        expiresAt: verification.expiresAt,
      })
      .catch(() => {
        // best-effort, intentionally swallowed
      });
  }

  return res.status(201).json({ status: 'ok' });
}
