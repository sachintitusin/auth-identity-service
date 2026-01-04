import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';

describe('POST /verifications/email (HTTP contract)', () => {
  const email = 'http.verify@example.com';
  const password = 'StrongPassword123!';

  beforeEach(async () => {
    await request(app)
      .post('/auth/register')
      .send({ email, password });
  });

  afterEach(async () => {
    await pool.query(`DELETE FROM verifications`);
    await pool.query(`DELETE FROM identity_identifiers`);
    await pool.query(`DELETE FROM credentials`);
    await pool.query(`DELETE FROM identities`);
  });

  it('returns 204 for an existing unverified email', async () => {
    const res = await request(app)
      .post('/verifications/email')
      .send({ email });

    expect(res.status).toBe(204);
  });

  it('returns 204 for a non-existent email', async () => {
    const res = await request(app)
      .post('/verifications/email')
      .send({ email: 'doesnotexist@example.com' });

    expect(res.status).toBe(204);
  });

  it('returns 204 for an already verified email', async () => {
    await pool.query(
      `
      UPDATE identity_identifiers
      SET verified_at = now()
      WHERE type = 'email'
        AND value = $1
      `,
      [email]
    );

    const res = await request(app)
      .post('/verifications/email')
      .send({ email });

    expect(res.status).toBe(204);
  });

  it('does not crash on malformed input', async () => {
    const res = await request(app)
      .post('/verifications/email')
      .send({});

    expect(res.status).toBe(204);
  });
});
