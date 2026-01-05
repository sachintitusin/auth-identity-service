import { Request, Response } from 'express';
import { pool } from '../db';
import { initiateEmailVerification } from '../domain/email-verification';
import { getEmailService } from '../infra/email';

export async function initiateEmailVerificationHandler(
  req: Request,
  res: Response
) {
  const { email } = req.body;

  const client = await pool.connect();
  let intent: Awaited<ReturnType<typeof initiateEmailVerification>> | null;

  try {
    await client.query('BEGIN');

    intent = await initiateEmailVerification(client, { email });

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  // ---- SIDE EFFECT (after commit) ----
  if (intent) {
    /**
     * getEmailService() method selects an email service based on
     * the environment variables provided. For dev test the 
     * noop email service is being used.
     */
    const emailService = getEmailService();

    const verificationLink =
      `${process.env.APP_BASE_URL}/verify-email?token=${intent.rawToken}`;


    // Fire-and-forget — never block the request
    emailService.sendVerificationEmail({
      to: email,
      verificationLink,
      expiresAt: intent.expiresAt,
    }).catch((err) => {
      // Log but never fail the request
      console.error('Email delivery failed:', err);
    });
  }

  return res.status(204).send();
}
