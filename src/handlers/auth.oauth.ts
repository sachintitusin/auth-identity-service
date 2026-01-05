import { Request, Response } from 'express';
import { OAuthAuthenticationService } from '../domain/oauth/oauth-authentication.service';
import { AuthenticationFailedError } from '../errors';

/**
 * POST /auth/oauth/google
 *
 * Body:
 * {
 *   "token": "<google_id_token>"
 * }
 */
export function oauthAuthenticateHandler(
  oauthService: OAuthAuthenticationService
) {
  return async function (req: Request, res: Response) {
    const { token } = req.body;

    // Basic input presence check (no semantics here)
    if (!token) {
      throw new AuthenticationFailedError();
    }

    try {
      /**
       * Delegate all real work to the domain service.
       */
      const result = await oauthService.authenticate(token);

      /**
       * Success:
       * - session already created
       * - refresh token already issued
       * - no access token issued here
       */
      return res.status(200).json({
        session: {
          id: result.sessionId,
        },
        refresh_token: result.refreshToken,
      });
    } catch {
      /**
       * Collapse all failures.
       *
       * No distinction between:
       * - invalid token
       * - expired token
       * - unknown identity
       * - DB conflicts
       */
      throw new AuthenticationFailedError();
    }
  };
}
