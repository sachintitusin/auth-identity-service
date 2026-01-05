import request from 'supertest';
import { app } from '../src/app';

describe('POST /auth/oauth/google (http)', () => {
  it('returns 200 and session + refresh token on success', async () => {
    const res = await request(app)
      .post('/auth/oauth/google')
      .send({ token: 'fake-token' });

    expect(res.status).toBe(200);
    expect(res.body.session).toBeDefined();
    expect(res.body.session.id).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();
  });

  it('fails with generic auth error when token missing', async () => {
    const res = await request(app)
      .post('/auth/oauth/google')
      .send({});

    expect(res.status).toBe(401); // or your mapped auth error
  });
});
