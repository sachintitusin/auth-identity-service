import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';

describe('POST /auth/register', () => {
  const email = 'user@example.com';
  const password = 'StrongPassword123!';

  afterEach(async () => {
    // Order matters due to FK constraints
    await pool.query(`DELETE FROM verifications`);
    await pool.query(`DELETE FROM password_credentials`);
    await pool.query(`DELETE FROM credentials`);
    await pool.query(`DELETE FROM identity_identifiers`);
    await pool.query(`DELETE FROM identities`);
  });

  it('creates identity, identifier, password credential and email verification', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email, password });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ status: 'ok' });

    // ---- identities ----
    const identities = await pool.query(`SELECT * FROM identities`);
    expect(identities.rowCount).toBe(1);
    expect(identities.rows[0].subject_id).toBeTruthy();

    const identityId = identities.rows[0].id;

    // ---- identity_identifiers ----
    const identifiers = await pool.query(
      `SELECT * FROM identity_identifiers WHERE identity_id = $1`,
      [identityId]
    );
    expect(identifiers.rowCount).toBe(1);
    expect(identifiers.rows[0].type).toBe('email');
    expect(identifiers.rows[0].value).toBe(email);
    expect(identifiers.rows[0].verified_at).toBeNull();

    const identifierId = identifiers.rows[0].id;

    // ---- credentials ----
    const credentials = await pool.query(
      `SELECT * FROM credentials WHERE identity_id = $1`,
      [identityId]
    );
    expect(credentials.rowCount).toBe(1);
    expect(credentials.rows[0].credential_type).toBe('password');
    expect(credentials.rows[0].revoked_at).toBeNull();

    const credentialId = credentials.rows[0].id;

    // ---- password_credentials ----
    const passwordCreds = await pool.query(
      `SELECT * FROM password_credentials WHERE credential_id = $1`,
      [credentialId]
    );
    expect(passwordCreds.rowCount).toBe(1);
    expect(passwordCreds.rows[0].identifier_id).toBe(identifierId);
    expect(passwordCreds.rows[0].password_hash).toBeTruthy();
    expect(passwordCreds.rows[0].hash_algorithm).toBe('bcrypt');

    // ---- verifications ----
    const verifications = await pool.query(
      `SELECT * FROM verifications WHERE identity_id = $1`,
      [identityId]
    );
    expect(verifications.rowCount).toBe(1);
    expect(verifications.rows[0].verification_type).toBe('email');
    expect(verifications.rows[0].hashed_token).toBeTruthy();
    expect(verifications.rows[0].expires_at).toBeTruthy();

    // ---- sessions ----
    const sessions = await pool.query(`SELECT * FROM sessions`);
    expect(sessions.rowCount).toBe(0);
  });

  it('does not reveal duplicate email and does not create partial data', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email, password });

    const res = await request(app)
      .post('/auth/register')
      .send({ email, password });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toMatchObject({
      error: 'REGISTRATION_FAILED',
    });

    const identities = await pool.query(`SELECT * FROM identities`);
    const identifiers = await pool.query(`SELECT * FROM identity_identifiers`);
    const credentials = await pool.query(`SELECT * FROM credentials`);
    const passwordCreds = await pool.query(`SELECT * FROM password_credentials`);
    const verifications = await pool.query(`SELECT * FROM verifications`);

    expect(identities.rowCount).toBe(1);
    expect(identifiers.rowCount).toBe(1);
    expect(credentials.rowCount).toBe(1);
    expect(passwordCreds.rowCount).toBe(1);
    expect(verifications.rowCount).toBe(1);
  });
});
