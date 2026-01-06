import { Pool } from 'pg';
import { OAuthProviderVerifier } from './oauth-provider-verifier';
import {
  findExternalIdentity,
  createExternalIdentity,
} from '../../repos/external-identities.repo';
import { createIdentity } from '../../repos/identities.repo';
import { createSessionWithRefreshToken } from '../session-creation.service';
import { emitAuditEvent } from '../audit/audit.service';
import { AuditEventType } from '../audit/audit.types';

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
   */
  async authenticate(assertion: string): Promise<{
    sessionId: string;
    refreshToken: string;
  }> {
    /**
     * Step 1: Verify provider assertion.
     * Pure cryptographic verification.
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
      let externalIdentityCreated = false;

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
        externalIdentityCreated = true;

        /**
         * 🔍 Audit: external identity created
         */
        await emitAuditEvent({
          eventType: AuditEventType.EXTERNAL_IDENTITY_CREATED,
          actor: {
            type: 'system',
            id: null,
          },
          target: {
            type: 'external_identity',
            id: identityId,
          },
          metadata: {
            provider: external.provider,
          },
        });
      }

      /**
       * Step 3: Create authenticated session
       * + issue initial refresh token.
       */
      const session = await createSessionWithRefreshToken(client, {
        identityId,
      });

      /**
       * 🔍 Audit: OAuth login success
       */
      await emitAuditEvent({
        eventType: AuditEventType.OAUTH_LOGIN_SUCCESS,
        actor: {
          type: 'identity',
          id: identityId,
        },
        target: {
          type: 'session',
          id: session.sessionId,
        },
        metadata: {
          provider: external.provider,
          first_time: externalIdentityCreated,
        },
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
