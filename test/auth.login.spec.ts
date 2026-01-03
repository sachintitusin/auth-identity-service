import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';

describe('POST /auth/login', () => {
  const email = 'login.user@example.com';
  const password = 'StrongPassword123!';

  beforeEach(async () => {
    // Register user
    await request(app)
      .post('/auth/register')
      .send({ email, password });

    // Mark email as verified (login requires verified identifier)
    await pool.query(
      `
      UPDATE identity_identifiers
      SET verified_at = now()
      WHERE type = 'email'
        AND value = $1
      `,
      [email]
    );
  });

  afterEach(async () => {
    // Order matters due to FK constraints
    await pool.query(`DELETE FROM refresh_tokens`);
    await pool.query(`DELETE FROM sessions`);
    await pool.query(`DELETE FROM verifications`);
    await pool.query(`DELETE FROM password_credentials`);
    await pool.query(`DELETE FROM credentials`);
    await pool.query(`DELETE FROM identity_identifiers`);
    await pool.query(`DELETE FROM identities`);
  });

  // ---------------- SUCCESS CASES ----------------

  it('logs in via browser and sets refresh token only as HttpOnly cookie', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email, password });

    expect(res.status).toBe(200);

    // ---- response body ----
    expect(res.body).toEqual({
      session: {
        id: expect.any(String),
      },
    });

    // ---- cookie assertions (type-safe) ----
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();

    const cookieArray = Array.isArray(cookies) ? cookies : [cookies];

    const refreshCookie = cookieArray.find((c: string) =>
      c.startsWith('refresh_token=')
    );

    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Path=/tokens/refresh');

    // ---- sessions ----
    const sessions = await pool.query(`SELECT * FROM sessions`);
    expect(sessions.rowCount).toBe(1);
    expect(sessions.rows[0].terminated_at).toBeNull();

    // ---- refresh_tokens ----
    const tokens = await pool.query(`SELECT * FROM refresh_tokens`);
    expect(tokens.rowCount).toBe(1);
    expect(tokens.rows[0].hashed_token).toBeTruthy();
    expect(tokens.rows[0].expires_at).toBeTruthy();
  });

  it('logs in via mobile and returns refresh token in response body', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('X-Refresh-Token-Delivery', 'body')
      .send({ email, password });

    expect(res.status).toBe(200);

    // ---- response body ----
    expect(res.body).toEqual({
      session: {
        id: expect.any(String),
      },
      refresh_token: expect.any(String),
    });

    // ---- cookie still set (mobile ignores it) ----
    expect(res.headers['set-cookie']).toBeDefined();

    // ---- DB assertions ----
    const sessions = await pool.query(`SELECT * FROM sessions`);
    const tokens = await pool.query(`SELECT * FROM refresh_tokens`);

    expect(sessions.rowCount).toBe(1);
    expect(tokens.rowCount).toBe(1);
  });

  // ---------------- FAILURE CASES ----------------

  it('fails with uniform 401 for wrong password and creates no session', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: 'AUTHENTICATION_FAILED',
    });

    const sessions = await pool.query(`SELECT * FROM sessions`);
    const tokens = await pool.query(`SELECT * FROM refresh_tokens`);

    expect(sessions.rowCount).toBe(0);
    expect(tokens.rowCount).toBe(0);
  });

  it('fails with uniform 401 for unknown email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'doesnotexist@example.com',
        password: 'Whatever123!',
      });

    expect(res.status).toBe(401);

    const sessions = await pool.query(`SELECT * FROM sessions`);
    const tokens = await pool.query(`SELECT * FROM refresh_tokens`);

    expect(sessions.rowCount).toBe(0);
    expect(tokens.rowCount).toBe(0);
  });

  it('fails with uniform 401 if email is not verified', async () => {
    const unverifiedEmail = 'unverified.login@example.com';

    await request(app)
      .post('/auth/register')
      .send({ email: unverifiedEmail, password });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: unverifiedEmail, password });

    expect(res.status).toBe(401);

    const sessions = await pool.query(`SELECT * FROM sessions`);
    const tokens = await pool.query(`SELECT * FROM refresh_tokens`);

    expect(sessions.rowCount).toBe(0);
    expect(tokens.rowCount).toBe(0);
  });
});
