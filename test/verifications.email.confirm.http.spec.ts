import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';

describe('POST /verifications/email/confirm (HTTP contract)', () => {
  const email = 'http.confirm@example.com';
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

  it('always returns 204 for a random token', async () => {
    const res = await request(app)
      .post('/verifications/email/confirm')
      .send({ token: 'random-garbage-token' });

    expect(res.status).toBe(204);
  });

  it('returns 204 when token is missing', async () => {
    const res = await request(app)
      .post('/verifications/email/confirm')
      .send({});

    expect(res.status).toBe(204);
  });

  it('returns 204 even when called multiple times', async () => {
    await request(app)
      .post('/verifications/email/confirm')
      .send({ token: 'anything' });

    const res = await request(app)
      .post('/verifications/email/confirm')
      .send({ token: 'anything' });

    expect(res.status).toBe(204);
  });
});
