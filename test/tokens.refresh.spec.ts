import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';

describe('POST /tokens/refresh', () => {
  const email = 'refresh.user@example.com';
  const password = 'StrongPassword123!';

  let initialRefreshToken: string;

  beforeEach(async () => {
    // ---- Register user ----
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

    // ---- Login (browser flow) ----
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email, password });

    const cookies = loginRes.headers['set-cookie'];
    const cookieArray = Array.isArray(cookies) ? cookies : [cookies];

    const refreshCookie = cookieArray.find((c: string) =>
      c.startsWith('refresh_token=')
    );

    expect(refreshCookie).toBeDefined();

    initialRefreshToken = refreshCookie!
      .split(';')[0]
      .split('=')[1];
  });

  afterEach(async () => {
    // Order matters (FK constraints)
    await pool.query(`DELETE FROM refresh_tokens`);
    await pool.query(`DELETE FROM sessions`);
    await pool.query(`DELETE FROM verifications`);
    await pool.query(`DELETE FROM password_credentials`);
    await pool.query(`DELETE FROM credentials`);
    await pool.query(`DELETE FROM identity_identifiers`);
    await pool.query(`DELETE FROM identities`);
  });

  // ---------------- SUCCESS CASES ----------------

  it('successfully refreshes token and rotates refresh token', async () => {
    const res = await request(app)
      .post('/tokens/refresh')
      .set('Cookie', [`refresh_token=${initialRefreshToken}`]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      access_token: expect.any(String),
      expires_in: expect.any(Number),
    });

    // ---- cookies ----
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();

    const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
    const newRefreshCookie = cookieArray.find((c: string) =>
      c.startsWith('refresh_token=')
    );

    expect(newRefreshCookie).toBeDefined();
    expect(newRefreshCookie).toContain('HttpOnly');

    // ---- DB assertions ----
    const tokens = await pool.query(
      `SELECT * FROM refresh_tokens ORDER BY created_at`
    );

    expect(tokens.rowCount).toBe(2);

    const [oldToken, newToken] = tokens.rows;

    expect(oldToken.used_at).not.toBeNull();
    expect(oldToken.replaced_by_token_id).toBe(newToken.id);

    expect(newToken.used_at).toBeNull();
    expect(newToken.revoked_at).toBeNull();

    const sessions = await pool.query(`SELECT * FROM sessions`);
    expect(sessions.rows[0].terminated_at).toBeNull();
  });

  it('refreshes token using body delivery for non-cookie clients', async () => {
    const res = await request(app)
      .post('/tokens/refresh')
      .set('X-Refresh-Token-Delivery', 'body')
      .send({ refresh_token: initialRefreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
      expires_in: expect.any(Number),
    });

    // Cookie may still be set, but body is authoritative
    expect(res.body.refresh_token).toBeTruthy();
  });

  // ---------------- FAILURE CASES ----------------

  it('fails with 401 if refresh token is missing', async () => {
    const res = await request(app)
      .post('/tokens/refresh');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: 'AUTHENTICATION_FAILED',
    });

    const sessions = await pool.query(`SELECT * FROM sessions`);
    expect(sessions.rows[0].terminated_at).toBeNull();
  });

  it('fails with 401 for invalid refresh token and does not revoke session', async () => {
    const res = await request(app)
      .post('/tokens/refresh')
      .set('Cookie', ['refresh_token=totally-invalid-token']);

    expect(res.status).toBe(401);

    const sessions = await pool.query(`SELECT * FROM sessions`);
    expect(sessions.rows[0].terminated_at).toBeNull();
  });

  it('revokes session on refresh token reuse', async () => {
    // ---- First refresh (valid) ----
    await request(app)
      .post('/tokens/refresh')
      .set('Cookie', [`refresh_token=${initialRefreshToken}`]);

    // ---- Reuse old token ----
    const reuseRes = await request(app)
      .post('/tokens/refresh')
      .set('Cookie', [`refresh_token=${initialRefreshToken}`]);

    expect(reuseRes.status).toBe(401);

    // ---- session revoked ----
    const sessions = await pool.query(`SELECT * FROM sessions`);
    expect(sessions.rows[0].terminated_at).not.toBeNull();
    expect(sessions.rows[0].termination_reason).toBe('TOKEN_REUSE');

    // ---- all refresh tokens revoked ----
    const tokens = await pool.query(`SELECT * FROM refresh_tokens`);
    for (const token of tokens.rows) {
      expect(token.revoked_at).not.toBeNull();
    }
  });

  it('fails closed on expired refresh token and revokes session', async () => {
    // Expire token manually
    await pool.query(
      `
      UPDATE refresh_tokens
      SET expires_at = now() - interval '1 second'
      `
    );

    const res = await request(app)
      .post('/tokens/refresh')
      .set('Cookie', [`refresh_token=${initialRefreshToken}`]);

    expect(res.status).toBe(401);

    const sessions = await pool.query(`SELECT * FROM sessions`);
    expect(sessions.rows[0].terminated_at).not.toBeNull();
  });

  it('handles concurrent refresh attempts safely', async () => {
    const attempt1 = request(app)
      .post('/tokens/refresh')
      .set('Cookie', [`refresh_token=${initialRefreshToken}`]);

    const attempt2 = request(app)
      .post('/tokens/refresh')
      .set('Cookie', [`refresh_token=${initialRefreshToken}`]);

    const results = await Promise.allSettled([attempt1, attempt2]);

    const statuses = results.map((r: any) => r.value?.status);

    expect(statuses.filter(s => s === 200).length).toBe(1);
    expect(statuses.filter(s => s === 401).length).toBe(1);

    const sessions = await pool.query(`SELECT * FROM sessions`);
    expect(sessions.rows[0].terminated_at).not.toBeNull();
  });
});
