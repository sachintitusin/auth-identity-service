import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';

describe('PUT /auth/password', () => {
  const email = 'password.change@example.com';
  const oldPassword = 'OldPassword123!@#';
  const newPassword = 'NewPassword456!@#';

  let refreshToken: string;
  let accessToken: string;

  beforeEach(async () => {
    // ---------------- Register ----------------
    await request(app)
      .post('/auth/register')
      .send({ email, password: oldPassword });

    // ---------------- Verify email ----------------
    await pool.query(
      `
      UPDATE identity_identifiers
      SET verified_at = now()
      WHERE type = 'email'
        AND value = $1
      `,
      [email]
    );

    // ---------------- Login (request refresh token in body) ----------------
    const loginRes = await request(app)
      .post('/auth/login')
      .set('X-Refresh-Token-Delivery', 'body')
      .send({ email, password: oldPassword });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.refresh_token).toBeDefined();

    refreshToken = loginRes.body.refresh_token;

    // ---------------- Refresh (request access token explicitly) ----------------
    const refreshRes = await request(app)
      .post('/tokens/refresh')
      .set('X-Refresh-Token-Delivery', 'body')
      .send({ refresh_token: refreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.access_token).toBeDefined();

    accessToken = refreshRes.body.access_token;
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

  // ================= SUCCESS CASES =================

  it('successfully changes password and revokes all sessions', async () => {
    const res = await request(app)
      .put('/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password: oldPassword,
        new_password: newPassword,
      });

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    // ---- sessions revoked ----
    const sessions = await pool.query(`SELECT * FROM sessions`);
    expect(sessions.rowCount).toBeGreaterThan(0);

    sessions.rows.forEach((s) => {
      expect(s.terminated_at).toBeTruthy();
      expect(s.termination_reason).toBe('PASSWORD_CHANGE');
    });

    // ---- refresh tokens revoked ----
    const tokens = await pool.query(`SELECT * FROM refresh_tokens`);
    tokens.rows.forEach((t) => {
      expect(t.revoked_at).toBeTruthy();
    });
  });

  it('allows login with new password after change', async () => {
    await request(app)
      .put('/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password: oldPassword,
        new_password: newPassword,
      });

    const res = await request(app)
      .post('/auth/login')
      .send({ email, password: newPassword });

    expect(res.status).toBe(200);
  });

  it('rejects login with old password after change', async () => {
    await request(app)
      .put('/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password: oldPassword,
        new_password: newPassword,
      });

    const res = await request(app)
      .post('/auth/login')
      .send({ email, password: oldPassword });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: 'AUTHENTICATION_FAILED',
    });
  });

  // ================= FAILURE CASES =================

  it('fails with 401 if access token is missing', async () => {
    const res = await request(app)
      .put('/auth/password')
      .send({
        current_password: oldPassword,
        new_password: newPassword,
      });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: 'UNAUTHORIZED',
    });
  });

  it('fails with uniform 401 if current password is wrong', async () => {
    const res = await request(app)
      .put('/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password: 'WrongPassword!!',
        new_password: newPassword,
      });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: 'AUTHENTICATION_FAILED',
    });
  });

  it('fails with uniform 401 if password credential is missing', async () => {
    await pool.query(
      `
      UPDATE credentials
      SET revoked_at = now()
      WHERE credential_type = 'password'
      `
    );

    const res = await request(app)
      .put('/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password: oldPassword,
        new_password: newPassword,
      });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: 'AUTHENTICATION_FAILED',
    });
  });

  it('fails with 400 for invalid request shape', async () => {
    const res = await request(app)
      .put('/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password: oldPassword,
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'BAD_REQUEST',
    });
  });

  it('is idempotent only in effect (second call fails safely)', async () => {
    await request(app)
      .put('/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password: oldPassword,
        new_password: newPassword,
      });

    const secondAttempt = await request(app)
      .put('/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        current_password: oldPassword,
        new_password: 'AnotherPassword789!@#',
      });

    expect(secondAttempt.status).toBe(401);
    expect(secondAttempt.body).toEqual({
      error: 'AUTHENTICATION_FAILED',
    });
  });
});
