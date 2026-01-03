import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';

describe('DELETE /sessions (global logout)', () => {
  const email = 'logout.all@example.com';
  const password = 'StrongPassword123!';

  let accessToken: string;

  beforeEach(async () => {
    // ---- Register ----
    await request(app)
      .post('/auth/register')
      .send({ email, password });

    // ---- Verify email ----
    await pool.query(
      `
      UPDATE identity_identifiers
      SET verified_at = now()
      WHERE type = 'email'
        AND value = $1
      `,
      [email]
    );

    // ---- Login #1 ----
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email, password });

    const refreshCookie = loginRes.headers['set-cookie'][0]
      .split(';')[0]
      .split('=')[1];

    // ---- Get access token ----
    const refreshRes = await request(app)
      .post('/tokens/refresh')
      .set('Cookie', `refresh_token=${refreshCookie}`);

    accessToken = refreshRes.body.access_token;

    // ---- Login #2 (second session) ----
    await request(app)
      .post('/auth/login')
      .send({ email, password });
  });

  afterEach(async () => {
    await pool.query(`
      TRUNCATE TABLE
        refresh_tokens,
        sessions,
        verifications,
        password_credentials,
        credentials,
        identity_identifiers,
        identities
      RESTART IDENTITY CASCADE
    `);
  });

  it('logs out all sessions for the authenticated identity', async () => {
    // ---- sanity check: 2 sessions exist ----
    const before = await pool.query(`SELECT * FROM sessions`);
    expect(before.rowCount).toBe(2);

    // ---- global logout ----
    const res = await request(app)
      .delete('/sessions')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);

    // ---- sessions terminated ----
    const sessions = await pool.query(`SELECT * FROM sessions`);
    sessions.rows.forEach((s) => {
      expect(s.terminated_at).toBeTruthy();
      expect(s.termination_reason).toBe('USER_LOGOUT');
    });

    // ---- refresh tokens revoked ----
    const tokens = await pool.query(`SELECT * FROM refresh_tokens`);
    tokens.rows.forEach((t) => {
      expect(t.revoked_at).toBeTruthy();
    });
  });
});
