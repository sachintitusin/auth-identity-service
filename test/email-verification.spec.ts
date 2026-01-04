import { pool } from '../src/db';
import {
  initiateEmailVerification,
  confirmEmailVerification,
} from '../src/domain/email-verification';

describe('Domain: Email Verification', () => {
  const email = 'domain.verify@example.com';

  let identityId: string;

  beforeEach(async () => {
    // Create identity + email identifier directly
    const res = await pool.query(
      `
      INSERT INTO identities (id, subject_id)
      VALUES (gen_random_uuid(), gen_random_uuid())
      RETURNING id
      `
    );

    identityId = res.rows[0].id;

    await pool.query(
      `
      INSERT INTO identity_identifiers (
        id,
        identity_id,
        type,
        value
      ) VALUES (
        gen_random_uuid(),
        $1,
        'email',
        $2
      )
      `,
      [identityId, email]
    );
  });

  afterEach(async () => {
    await pool.query(`DELETE FROM verifications`);
    await pool.query(`DELETE FROM identity_identifiers`);
    await pool.query(`DELETE FROM identities`);
  });

  // ---------------- INITIATION ----------------

  it('creates a verification token for an unverified email', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const intent = await initiateEmailVerification(client, { email });

      await client.query('COMMIT');

      expect(intent).not.toBeNull();
      expect(intent!.rawToken).toBeTruthy();
      expect(intent!.expiresAt).toBeInstanceOf(Date);

      const rows = await pool.query(`SELECT * FROM verifications`);
      expect(rows.rowCount).toBe(1);
      expect(rows.rows[0].used_at).toBeNull();
      expect(rows.rows[0].invalidated_at).toBeNull();
    } finally {
      client.release();
    }
  });

  // ---------------- CONFIRMATION ----------------

  it('verifies email with a valid token', async () => {
    const client = await pool.connect();
    let rawToken: string;

    try {
      await client.query('BEGIN');

      const intent = await initiateEmailVerification(client, { email });
      rawToken = intent!.rawToken;

      await confirmEmailVerification(client, { rawToken });

      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const identifier = await pool.query(
      `
      SELECT verified_at
      FROM identity_identifiers
      WHERE value = $1
      `,
      [email]
    );

    expect(identifier.rows[0].verified_at).toBeTruthy();
  });

  // ---------------- IDEMPOTENCY ----------------

  it('is idempotent for reused tokens', async () => {
    const client = await pool.connect();
    let rawToken: string;

    try {
      await client.query('BEGIN');

      const intent = await initiateEmailVerification(client, { email });
      rawToken = intent!.rawToken;

      await confirmEmailVerification(client, { rawToken });
      await confirmEmailVerification(client, { rawToken });

      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const identifier = await pool.query(
      `
      SELECT verified_at
      FROM identity_identifiers
      WHERE value = $1
      `,
      [email]
    );

    expect(identifier.rows[0].verified_at).toBeTruthy();
  });

  // ---------------- INVALID TOKEN ----------------

  it('does nothing for an invalid token', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await confirmEmailVerification(client, {
        rawToken: 'invalid-token',
      });

      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const identifier = await pool.query(
      `
      SELECT verified_at
      FROM identity_identifiers
      WHERE value = $1
      `,
      [email]
    );

    expect(identifier.rows[0].verified_at).toBeNull();
  });
});
