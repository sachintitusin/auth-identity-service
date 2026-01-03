import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';

describe('DELETE /sessions/current', () => {
  const email = 'logout.user@example.com';
  const password = 'StrongPassword123!';

  let accessToken: string;
  let refreshToken: string;

  beforeEach(async () => {
    // ---- Register ----
    await request(app)
      .post('/auth/register')
      .send({ email, password });

    // ---- Verify email (login requires verified identifier) ----
    await pool.query(
      `
      UPDATE identity_identifiers
      SET verified_at = now()
      WHERE type = 'email'
        AND value = $1
      `,
      [email]
    );

    // ---- Login ----
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email, password });

    expect(loginRes.status).toBe(200);

    // ---- Extract refresh token from Set-Cookie (type-safe) ----
    const setCookieHeader = loginRes.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();

    const cookieArray = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : [setCookieHeader];

    const refreshCookie = cookieArray.find((c: string) =>
      c.startsWith('refresh_token=')
    );

    expect(refreshCookie).toBeDefined();

    refreshToken = refreshCookie!
      .split(';')[0]
      .split('=')[1];

    // ---- Refresh to obtain access token ----
    const refreshRes = await request(app)
      .post('/tokens/refresh')
      .set('Cookie', `refresh_token=${refreshToken}`);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.access_token).toBeDefined();

    accessToken = refreshRes.body.access_token;
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

  // ---------------- SUCCESS CASES ----------------

  it('logs out the current session and revokes all refresh tokens', async () => {
    const res = await request(app)
      .delete('/sessions/current')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);

    // ---- sessions ----
    const sessions = await pool.query(`SELECT * FROM sessions`);
    expect(sessions.rowCount).toBe(1);
    expect(sessions.rows[0].terminated_at).toBeTruthy();
    expect(sessions.rows[0].termination_reason).toBe('USER_LOGOUT');

    // ---- refresh_tokens ----
    const tokens = await pool.query(`SELECT * FROM refresh_tokens`);
    expect(tokens.rowCount).toBeGreaterThanOrEqual(1);

    // Every refresh token must be revoked
    for (const token of tokens.rows) {
      expect(token.revoked_at).toBeTruthy();
    }
  });

  it('is idempotent when called multiple times', async () => {
    await request(app)
      .delete('/sessions/current')
      .set('Authorization', `Bearer ${accessToken}`);

    const second = await request(app)
      .delete('/sessions/current')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(second.status).toBe(204);

    const sessions = await pool.query(`SELECT * FROM sessions`);
    expect(sessions.rowCount).toBe(1);
  });

  // ---------------- FAILURE CASES ----------------

  it('fails with 401 if access token is missing', async () => {
    const res = await request(app)
      .delete('/sessions/current');

    expect(res.status).toBe(401);
  });

  it('fails with 401 if access token is invalid', async () => {
    const res = await request(app)
      .delete('/sessions/current')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
  });

  // ---------------- SECURITY GUARANTEE ----------------

  it('prevents refresh token usage after logout', async () => {
    await request(app)
      .delete('/sessions/current')
      .set('Authorization', `Bearer ${accessToken}`);

    const res = await request(app)
      .post('/tokens/refresh')
      .set('Cookie', `refresh_token=${refreshToken}`);

    expect(res.status).toBe(401);
  });
});
