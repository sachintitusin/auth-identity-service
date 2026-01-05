import { OAuthAssertion } from './oauth-assertion';

export interface OAuthProviderVerifier {
  verify(assertion: string): Promise<OAuthAssertion>;
}