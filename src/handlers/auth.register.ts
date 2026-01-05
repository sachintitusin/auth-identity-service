import { pool } from '../db';
import { randomUUID, randomBytes, createHash } from 'crypto';
import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { RegistrationFailedError } from '../errors';
import { getEmailService } from '../infra/email';

export async function register(req: Request, res: Response) {
  const { email, password } = req.body;

  const client = await pool.connect();

  // We need rawToken AFTER commit, so keep it outside
  let rawTokenForEmail: string | null = null;
  let verificationExpiresAt: Date | null = null;

  try {
    await client.query('BEGIN');

    // ---- IDs ----
    const identityId = randomUUID();
    const subjectId = randomUUID();
    const identifierId = randomUUID();
    const credentialId = randomUUID();
    const verificationId = randomUUID();

    // ---- 1. Identity ----
    await client.query(
      `
      INSERT INTO identities (id, subject_id)
      VALUES ($1, $2)
      `,
      [identityId, subjectId]
    );

    // ---- 2. Identity Identifier ----
    await client.query(
      `
      INSERT INTO identity_identifiers (
        id,
        identity_id,
        type,
        value,
        verified_at
      ) VALUES ($1, $2, 'email', $3, NULL)
      `,
      [identifierId, identityId, email]
    );

    // ---- 3. Credential ----
    await client.query(
      `
      INSERT INTO credentials (
        id,
        identity_id,
        credential_type
      ) VALUES ($1, $2, 'password')
      `,
      [credentialId, identityId]
    );

    // ---- 4. Password Credential ----
    const passwordHash = await bcrypt.hash(password, 12);

    await client.query(
      `
      INSERT INTO password_credentials (
        credential_id,
        identifier_id,
        password_hash,
        hash_algorithm
      ) VALUES ($1, $2, $3, 'bcrypt')
      `,
      [credentialId, identifierId, passwordHash]
    );

    // ---- 5. Email Verification ----
    const rawToken = randomBytes(32).toString('base64url');
    const hashedToken = createHash('sha256')
      .update(rawToken)
      .digest();

    verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await client.query(
      `
      INSERT INTO verifications (
        id,
        identity_id,
        verification_type,
        hashed_token,
        expires_at
      ) VALUES ($1, $2, 'email', $3, $4)
      `,
      [verificationId, identityId, hashedToken, verificationExpiresAt]
    );

    // Save for AFTER commit
    rawTokenForEmail = rawToken;

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw new RegistrationFailedError();
  } finally {
    client.release();
  }

  // ---- 6. Email delivery (OUTSIDE transaction) ----
  if (rawTokenForEmail && verificationExpiresAt) {
    const emailService = getEmailService();

    // Best-effort: do NOT let this throw
    emailService.sendVerificationEmail({
      to: email,
      verificationLink: `${process.env.FRONTEND_BASE_URL}/verify-email?token=${rawTokenForEmail}`,
      expiresAt: verificationExpiresAt,
    }).catch(() => {
      // intentionally swallowed
      // optional: structured log / metric
    });
  }

  return res.status(201).json({ status: 'ok' });
}
