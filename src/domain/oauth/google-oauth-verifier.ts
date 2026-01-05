import { jwtVerify, createRemoteJWKSet } from 'jose';
import { OAuthProviderVerifier } from './oauth-provider-verifier';
import { OAuthAssertion } from './oauth-assertion';

/**
 * Google can issue ID tokens with either of these issuers.
 * We explicitly whitelist them to avoid accepting tokens
 * from look-alike or misconfigured issuers.
 */
const GOOGLE_ISSUERS = new Set([
  'https://accounts.google.com',
  'accounts.google.com',
]);

/**
 * GoogleOAuthVerifier is a pure domain component.
 *
 * Responsibility:
 *  - Cryptographically verify a Google ID token
 *  - Ensure it was issued for *our* application
 *  - Extract the stable external subject (`sub`)
 *
 * It does NOT:
 *  - touch the database
 *  - create identities
 *  - start sessions
 *  - trust email or profile data
 */
export class GoogleOAuthVerifier implements OAuthProviderVerifier {

  /**
   * JWKS (JSON Web Key Set) endpoint provided by Google.
   *
   * `createRemoteJWKSet`:
   *  - fetches Google's public signing keys on demand
   *  - caches them internally
   *  - automatically selects the correct key based on JWT header
   *
   * This allows key rotation without code changes.
   */
  private jwks = createRemoteJWKSet(
    new URL('https://www.googleapis.com/oauth2/v3/certs')
  );

  /**
   * @param clientId
   * OAuth client ID issued by Google for this application.
   *
   * Used to validate the `aud` (audience) claim, ensuring
   * the token was intended for *this* backend.
   */
  constructor(private readonly clientId: string) {}

  /**
   * Verifies a Google ID token and returns a minimal OAuthAssertion.
   *
   * @param idToken
   * Raw ID token received from the client.
   *
   * @throws Error
   * If the token is invalid, expired, forged, or not meant for us.
   */
  async verify(idToken: string): Promise<OAuthAssertion> {

    /**
     * Step 1: Cryptographically verify the JWT.
     *
     * This does ALL of the following:
     *  - verifies the signature using Google's public keys
     *  - checks token expiry (`exp`)
     *  - checks audience (`aud`) matches our clientId
     *
     * Any failure here throws and aborts authentication.
     */
    const { payload } = await jwtVerify(idToken, this.jwks, {
      audience: this.clientId,
    });

    /**
     * Step 2: Explicit issuer validation.
     *
     * Even though the signature is valid, we still verify
     * that the token was issued by a trusted Google issuer.
     *
     * This is defense-in-depth against mis-issued or replayed tokens.
     */
    if (!payload.iss || !GOOGLE_ISSUERS.has(payload.iss)) {
      throw new Error('Invalid issuer');
    }

    /**
     * Step 3: Extract the external subject.
     *
     * `sub` is:
     *  - stable
     *  - immutable
     *  - the ONLY binding identifier we trust
     *
     * Email, name, picture, etc. are intentionally ignored.
     */
    if (!payload.sub) {
      throw new Error('Missing subject');
    }

    /**
     * Step 4: Return a minimal, provider-agnostic assertion.
     *
     * From this point on, the rest of the system:
     *  - does not care about JWTs
     *  - does not care about Google-specific claims
     *  - only works with (provider, providerSubject)
     */
    return {
      provider: 'google',
      providerSubject: payload.sub,
    };
  }
}
