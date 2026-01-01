import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';

describe('POST /auth/register – request validation', () => {
  afterEach(async () => {
    // Clean in FK-safe order
    await pool.query(`DELETE FROM verifications`);
    await pool.query(`DELETE FROM password_credentials`);
    await pool.query(`DELETE FROM credentials`);
    await pool.query(`DELETE FROM identity_identifiers`);
    await pool.query(`DELETE FROM identities`);
  });

  it('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'not-an-email',
        password: 'StrongPassword123!',
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: 'BAD_REQUEST',
    });

    // Ensure NO partial writes
    const identities = await pool.query(`SELECT * FROM identities`);
    const credentials = await pool.query(`SELECT * FROM credentials`);
    const identifiers = await pool.query(`SELECT * FROM identity_identifiers`);

    expect(identities.rowCount).toBe(0);
    expect(credentials.rowCount).toBe(0);
    expect(identifiers.rowCount).toBe(0);
  });

  it('rejects password shorter than minimum length', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'user@example.com',
        password: 'short123',
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: 'BAD_REQUEST',
    });

    const identities = await pool.query(`SELECT * FROM identities`);
    expect(identities.rowCount).toBe(0);
  });

  it('rejects password without letters', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'user@example.com',
        password: '1234567890123!',
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: 'BAD_REQUEST',
    });

    const identities = await pool.query(`SELECT * FROM identities`);
    expect(identities.rowCount).toBe(0);
  });

  it('rejects password without number or symbol', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'user@example.com',
        password: 'OnlyLettersPassword',
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: 'BAD_REQUEST',
    });

    const identities = await pool.query(`SELECT * FROM identities`);
    expect(identities.rowCount).toBe(0);
  });
});
