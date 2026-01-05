import { pool } from '../../src/db';
import { registerWithPassword } from '../../src/domain/register-with-password';

describe('registerWithPassword (domain)', () => {
  afterEach(async () => {
    // clean DB between tests (order matters because of FKs)
    await pool.query('DELETE FROM verifications');
    await pool.query('DELETE FROM password_credentials');
    await pool.query('DELETE FROM credentials');
    await pool.query('DELETE FROM identity_identifiers');
    await pool.query('DELETE FROM identities');
  });

  it('creates identity, email identifier, password credential, and email verification', async () => {
    const client = await pool.connect();

    let result: Awaited<ReturnType<typeof registerWithPassword>>;

    try {
      await client.query('BEGIN');

      result = await registerWithPassword(client, {
        email: 'user@example.com',
        password: 'StrongPassword123!',
      });

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // ---- Identity ----
    const identityRes = await pool.query(
      `SELECT id FROM identities WHERE id = $1`,
      [result.identityId]
    );
    expect(identityRes.rowCount).toBe(1);

    // ---- Email identifier (unverified) ----
    const identifierRes = await pool.query(
      `
      SELECT verified_at
      FROM identity_identifiers
      WHERE identity_id = $1
        AND type = 'email'
        AND value = $2
      `,
      [result.identityId, 'user@example.com']
    );

    expect(identifierRes.rowCount).toBe(1);
    expect(identifierRes.rows[0].verified_at).toBeNull();

    // ---- Password credential ----
    const credentialRes = await pool.query(
      `
      SELECT c.id
      FROM credentials c
      JOIN password_credentials pc
        ON pc.credential_id = c.id
      WHERE c.identity_id = $1
        AND c.credential_type = 'password'
        AND c.revoked_at IS NULL
      `,
      [result.identityId]
    );

    expect(credentialRes.rowCount).toBe(1);

    // ---- Email verification ----
    const verificationRes = await pool.query(
      `
      SELECT
        hashed_token,
        expires_at,
        used_at,
        invalidated_at
      FROM verifications
      WHERE identity_id = $1
        AND verification_type = 'email'
      `,
      [result.identityId]
    );

    expect(verificationRes.rowCount).toBe(1);

    const verification = verificationRes.rows[0];

    // raw token must never be stored
    expect(Buffer.isBuffer(verification.hashed_token)).toBe(true);
    expect(verification.hashed_token.length).toBeGreaterThan(0);

    expect(verification.used_at).toBeNull();
    expect(verification.invalidated_at).toBeNull();

    // expiry should be in the future
    expect(new Date(verification.expires_at).getTime()).toBeGreaterThan(
      Date.now()
    );

    // returned intent must include raw token & expiry
    expect(result.verification.rawToken).toBeDefined();
    expect(result.verification.rawToken.length).toBeGreaterThan(10);
    expect(result.verification.expiresAt).toBeInstanceOf(Date);
  });
});
