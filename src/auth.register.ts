import { pool } from './db';
import { randomUUID, randomBytes, createHash } from 'crypto';
import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { RegistrationFailedError } from './errors';

export async function register(req: Request, res: Response) {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ---- IDs (explicit, deterministic) ----
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

    // ---- 2. Identity Identifier (email, unverified) ----
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

    // ---- 3. Credential (password) ----
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

    // ---- 4. Password Credential (secret implementation) ----
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

    // ---- 5. Email Verification (token-based, hashed) ----
    const rawToken = randomBytes(32); // NEVER stored
    const hashedToken = createHash('sha256')
      .update(rawToken)
      .digest(); // BYTEA

    await client.query(
      `
      INSERT INTO verifications (
        id,
        identity_id,
        verification_type,
        hashed_token,
        expires_at
      ) VALUES ($1, $2, 'email', $3, now() + interval '24 hours')
      `,
      [verificationId, identityId, hashedToken]
    );

    await client.query('COMMIT');

    // IMPORTANT:
    // rawToken is intentionally NOT returned here.
    // It is meant for downstream email delivery / outbox later.

    return res.status(201).json({ status: 'ok' });
  } catch (err) {
    await client.query('ROLLBACK');

    // Collapse ALL failures (including duplicate email)
    throw new RegistrationFailedError();
  } finally {
    client.release();
  }
}
