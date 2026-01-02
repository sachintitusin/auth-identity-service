import { Request} from 'express';
import { pool } from './db';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { createRefreshToken } from './repos/refresh-tokens.repo';
import { UnauthorizedError } from './errors';


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
      throw new UnauthorizedError('AUTHENTICATION_FAILED');
    }

    const { identity_id } = identifierResult.rows[0];

    // ---- 2. Resolve credential (password) ----
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
      throw new UnauthorizedError('AUTHENTICATION_FAILED');
    }

    const credentialId = credentialResult.rows[0].id;

    // ---- 3. Load password credential ----
    const passwordResult = await client.query(
      `
      SELECT password_hash
      FROM password_credentials
      WHERE credential_id = $1
      `,
      [credentialId]
    );

    if (passwordResult.rowCount === 0) {
      // Defensive: should never happen if invariants hold
      throw new UnauthorizedError('AUTHENTICATION_FAILED');
    }

    const { password_hash } = passwordResult.rows[0];

    // ---- 4. Verify password (always run bcrypt) ----
    const passwordMatches = await bcrypt.compare(password, password_hash);

    if (!passwordMatches) {
      throw new UnauthorizedError('AUTHENTICATION_FAILED');
    }

    // ---- 5. Create session + refresh token (transactional) ----
    await client.query('BEGIN');

    const sessionId = randomUUID();
    const sessionIdentifier = randomUUID();

    await client.query(
      `
      INSERT INTO sessions (
        id,
        identity_id,
        session_identifier
      ) VALUES ($1, $2, $3)
      `,
      [sessionId, identity_id, sessionIdentifier]
    );

    const { rawRefreshToken } = await createRefreshToken(client, {
      sessionId,
    });

    await client.query('COMMIT');

    // ---- 6. Success response ----
    // This is not returned to the client. The router captures it and transforms accordingly
    // This is to ensure that the controller doesn't decide the response transport policy
    // It is done by route here
    return {
      session: {
        id: sessionIdentifier,
      },
      // the _ before _refreshToken means it is for internal use only
      _refreshToken: rawRefreshToken,
    };
  } catch (err) {
    await client.query('ROLLBACK');

    // Collapse all auth failures intentionally
    throw new UnauthorizedError('AUTHENTICATION_FAILED');
  } finally {
    client.release();
  }
}