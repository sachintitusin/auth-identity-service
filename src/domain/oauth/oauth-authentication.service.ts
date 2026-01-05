import { Pool } from 'pg';
import { OAuthProviderVerifier } from './oauth-provider-verifier';
import {
  findExternalIdentity,
  createExternalIdentity,
} from '../../repos/external-identities.repo';
import { createIdentity } from '../../repos/identities.repo';
import { createSessionWithRefreshToken } from '../session-creation.service';

/**
 * OAuthAuthenticationService
 *
 * Composes:
 *  - OAuth provider verification
 *  - External identity resolution
 *  - Internal identity creation
 *  - Session + refresh token creation
 *
 * This service is transport-agnostic and testable in isolation.
 */
export class OAuthAuthenticationService {
  constructor(
    private readonly pool: Pool,
    private readonly verifier: OAuthProviderVerifier
  ) {}

  /**
   * Authenticate using an OAuth assertion.
   *
   * @param assertion
   * Raw provider assertion (e.g. Google ID token)
   *
   * @throws Error
   * On any authentication failure (collapsed by caller)
   */
  async authenticate(assertion: string): Promise<{
    sessionId: string;
    refreshToken: string;
  }> {
    /**
     * Step 1: Verify provider assertion.
     *
     * Pure cryptographic verification.
     * No database access yet.
     */
    const external = await this.verifier.verify(assertion);

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      /**
       * Step 2: Resolve external identity.
       */
      const existingExternal = await findExternalIdentity(client, {
        provider: external.provider,
        providerSubject: external.providerSubject,
      });

      let identityId: string;

      if (existingExternal) {
        /**
         * Returning OAuth user.
         */
        identityId = existingExternal.identityId;
      } else {
        /**
         * First-time OAuth user.
         */
        const identity = await createIdentity(client);

        await createExternalIdentity(client, {
          identityId: identity.id,
          provider: external.provider,
          providerSubject: external.providerSubject,
        });

        identityId = identity.id;
      }

      /**
       * Step 3: Create authenticated session
       * + issue initial refresh token.
       */
      const session = await createSessionWithRefreshToken(client, {
        identityId,
      });

      await client.query('COMMIT');

      return {
        sessionId: session.sessionId,
        refreshToken: session.refreshToken,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
