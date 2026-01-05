import { Request } from 'express';
import { pool } from '../db';
import bcrypt from 'bcrypt';
import { AuthenticationFailedError } from '../errors';
import { createSessionWithRefreshToken } from '../domain/session-creation.service';

export type LoginResult = {
  session: {
    id: string;
  };
  _refreshToken: string;
};

export async function login(req: Request): Promise<LoginResult> {
  const { email, password } = req.body;

  const client = await pool.connect();

  try {
    // ---- 1. Resolve identifier (email) ----
    const identifierResult = await client.query(
      `
      SELECT id, identity_id
      FROM identity_identifiers
      WHERE type = 'email'
        AND value = $1
        AND verified_at IS NOT NULL
      `,
      [email]
    );

    if (identifierResult.rowCount === 0) {
      throw new AuthenticationFailedError();
    }

    const { identity_id } = identifierResult.rows[0];

    // ---- 2. Resolve active password credential ----
    const credentialResult = await client.query(
      `
      SELECT id
      FROM credentials
      WHERE identity_id = $1
        AND credential_type = 'password'
        AND revoked_at IS NULL
      `,
      [identity_id]
    );

    if (credentialResult.rowCount === 0) {
      throw new AuthenticationFailedError();
    }

    const credentialId = credentialResult.rows[0].id;

    // ---- 3. Load password hash ----
    const passwordResult = await client.query(
      `
      SELECT password_hash
      FROM password_credentials
      WHERE credential_id = $1
      `,
      [credentialId]
    );

    if (passwordResult.rowCount === 0) {
      throw new AuthenticationFailedError();
    }

    const { password_hash } = passwordResult.rows[0];

    // ---- 4. Verify password ----
    const passwordMatches = await bcrypt.compare(password, password_hash);

    if (!passwordMatches) {
      throw new AuthenticationFailedError();
    }

    // ---- 5. Create session (delegated to domain) ----
    await client.query('BEGIN');

    const session = await createSessionWithRefreshToken(client, {
      identityId: identity_id,
    });

    await client.query('COMMIT');

    return {
      session: {
        id: session.sessionIdentifier,
      },
      _refreshToken: session.refreshToken,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
