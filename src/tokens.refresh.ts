import { Request, Response } from 'express';
import { refreshSessionTokens } from './domain/refresh-tokens.service';
import { issueAccessToken } from './domain/access-token.service';

/**
 * POST /tokens/refresh
 *
 * Public orchestration endpoint.
 * No business logic. Fail closed.
 */
export async function refreshTokens(req: Request, res: Response) {
  try {
    let refreshToken: string | undefined;

    // --- Extract refresh token ---
    if (req.header('X-Refresh-Token-Delivery') === 'body') {
      refreshToken = req.body?.refresh_token;
    } else {
      refreshToken = req.cookies?.refresh_token;
    }

    if (!refreshToken) {
      return res.status(401).json({ error: 'AUTHENTICATION_FAILED' });
    }

    // --- Domain refresh orchestration ---
    const { sessionId, refreshToken: newRefreshToken } =
      await refreshSessionTokens(refreshToken);

    // --- Issue access token ---
    // NOTE: subject will be corrected in Phase 6
    const { accessToken, expiresIn } = issueAccessToken({
      subject: sessionId,
      sessionId,
    });

    // --- Deliver refresh token ---
    if (req.header('X-Refresh-Token-Delivery') === 'body') {
      return res.status(200).json({
        access_token: accessToken,
        refresh_token: newRefreshToken,
        expires_in: expiresIn,
      });
    }

    // Default: HttpOnly cookie
    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/tokens/refresh',
    });

    return res.status(200).json({
      access_token: accessToken,
      expires_in: expiresIn,
    });
  } catch {
    // Fail closed
    return res.status(401).json({ error: 'AUTHENTICATION_FAILED' });
  }
}
