import { pool } from '../src/db';
import { OAuthAuthenticationService } from '../src/domain/oauth/oauth-authentication.service';
import { OAuthProviderVerifier } from '../src/domain/oauth/oauth-provider-verifier';
import { randomUUID } from 'crypto';

describe('OAuthAuthenticationService (domain)', () => {
  let oauthService: OAuthAuthenticationService;

  /**
   * Fake verifier to avoid Google dependency.
   * This is the ONLY thing we stub.
   */
  const fakeVerifier: OAuthProviderVerifier = {
    async verify() {
      return {
        provider: 'google',
        providerSubject: 'test-google-subject-123',
      };
    },
  };

  beforeEach(async () => {
    // Clean DB between tests
    await pool.query('BEGIN');
    await pool.query('TRUNCATE TABLE refresh_tokens CASCADE');
    await pool.query('TRUNCATE TABLE sessions CASCADE');
    await pool.query('TRUNCATE TABLE external_identities CASCADE');
    await pool.query('TRUNCATE TABLE identities CASCADE');
    await pool.query('COMMIT');

    oauthService = new OAuthAuthenticationService(pool, fakeVerifier);
  });

  it('creates identity, external identity, session and refresh token on first OAuth login', async () => {
    const result = await oauthService.authenticate('fake-token');

    expect(result.sessionId).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();

    // ---- Assert identity created ----
    const identities = await pool.query(
      `SELECT * FROM identities`
    );
    expect(identities.rowCount).toBe(1);

    // ---- Assert external identity bound ----
    const external = await pool.query(
      `SELECT * FROM external_identities`
    );
    expect(external.rowCount).toBe(1);
    expect(external.rows[0].provider).toBe('google');
    expect(external.rows[0].provider_subject).toBe('test-google-subject-123');

    // ---- Assert session created ----
    const sessions = await pool.query(
      `SELECT * FROM sessions`
    );
    expect(sessions.rowCount).toBe(1);

    // ---- Assert refresh token created ----
    const tokens = await pool.query(
      `SELECT * FROM refresh_tokens`
    );
    expect(tokens.rowCount).toBe(1);
    expect(tokens.rows[0].used_at).toBeNull();
    expect(tokens.rows[0].revoked_at).toBeNull();
  });

  it('reuses identity on repeated OAuth login with same external subject', async () => {
    const first = await oauthService.authenticate('fake-token');
    const second = await oauthService.authenticate('fake-token');

    expect(first.sessionId).not.toBe(second.sessionId);
    expect(first.refreshToken).not.toBe(second.refreshToken);

    // ---- Identity reused ----
    const identities = await pool.query(
      `SELECT * FROM identities`
    );
    expect(identities.rowCount).toBe(1);

    // ---- External identity still one ----
    const external = await pool.query(
      `SELECT * FROM external_identities`
    );
    expect(external.rowCount).toBe(1);

    // ---- Two sessions ----
    const sessions = await pool.query(
      `SELECT * FROM sessions`
    );
    expect(sessions.rowCount).toBe(2);

    // ---- Two refresh tokens (one per session) ----
    const tokens = await pool.query(
      `SELECT * FROM refresh_tokens`
    );
    expect(tokens.rowCount).toBe(2);
  });
});
