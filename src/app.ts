import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { pool } from './db';
import { requestIdMiddleware } from './request-id';
import { errorHandler } from './error-handler';

import { validateBody } from './middleware/validate';
import { authenticateAccessToken } from './middleware/authenticate-access-token';

// ---- Auth handlers ----
import { register } from './handlers/auth.register';
import { login } from './handlers/auth.login';
import { changePassword } from './handlers/auth.password.change';
import { logoutCurrentSession } from './handlers/sessions.logout';
import { logoutAllSessions } from './handlers/sessions.logout.all';
import { refreshTokens } from './handlers/tokens.refresh';

// ---- Schemas ----
import { registerSchema } from './schemas/register.schema';
import { loginSchema } from './schemas/login.schema';
import { changePasswordSchema } from './schemas/auth.password.change.schema';

// ---- Verification handlers ----
import {
  initiateEmailVerificationHandler,
} from './handlers/verifications.email';
import {
  confirmEmailVerificationHandler,
} from './handlers/verifications.email.confirm';

// ---- OAuth (NO static Google import here) ----
import { OAuthAuthenticationService } from './domain/oauth/oauth-authentication.service';
import { OAuthProviderVerifier } from './domain/oauth/oauth-provider-verifier';
import { oauthAuthenticateHandler } from './handlers/auth.oauth';

import cors from 'cors';

export const app = express();

/* ---------------- middleware ---------------- */

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(requestIdMiddleware);

morgan.token('request-id', (req) => (req as any).requestId);
app.use(
  morgan(':method :url :status :response-time ms - reqId=:request-id')
);

/* ---------------- health ---------------- */

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/health/db', async (_req, res, next) => {
  try {
    await pool.query('select 1');
    res.status(200).json({ status: 'ok', db: 'up' });
  } catch (err) {
    next(err);
  }
});

/* ---------------- auth ---------------- */

app.post('/auth/register', validateBody(registerSchema), register);

app.post('/auth/login', validateBody(loginSchema), async (req, res) => {
  const result = await login(req);

  // Always set HttpOnly refresh token cookie
  res.cookie('refresh_token', result._refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/tokens/refresh',
  });

  // Explicit mobile opt-in
  if (req.header('X-Refresh-Token-Delivery') === 'body') {
    return res.status(200).json({
      session: result.session,
      refresh_token: result._refreshToken,
    });
  }

  return res.status(200).json({
    session: result.session,
  });
});

app.post('/tokens/refresh', refreshTokens);

app.delete(
  '/sessions/current',
  authenticateAccessToken,
  logoutCurrentSession
);

app.delete(
  '/sessions',
  authenticateAccessToken,
  logoutAllSessions
);

app.put(
  '/auth/password',
  validateBody(changePasswordSchema),
  authenticateAccessToken,
  changePassword
);

/* ---------------- email verification ---------------- */

app.post('/verifications/email', initiateEmailVerificationHandler);
app.post('/verifications/email/confirm', confirmEmailVerificationHandler);

/* ---------------- OAuth ---------------- */

/**
 * IMPORTANT:
 * We MUST NOT eagerly import GoogleOAuthVerifier,
 * because it pulls in `jose` (pure ESM) which breaks Jest.
 *
 * Instead:
 * - In tests → inline minimal verifier
 * - In production → lazy require GoogleOAuthVerifier
 */
let oauthVerifier: OAuthProviderVerifier;

if (process.env.NODE_ENV === 'test') {
  // Minimal inline verifier for HTTP wiring tests
  oauthVerifier = {
    async verify() {
      return {
        provider: 'google',
        providerSubject: 'test-google-subject',
      };
    },
  };
} else {
  // Lazy-load to avoid Jest seeing `jose`
  const { GoogleOAuthVerifier } = require('./domain/oauth/google-oauth-verifier');

  oauthVerifier = new GoogleOAuthVerifier(
    process.env.GOOGLE_CLIENT_ID!
  );
}

const oauthService = new OAuthAuthenticationService(
  pool,
  oauthVerifier
);

app.post(
  '/auth/oauth/google',
  oauthAuthenticateHandler(oauthService)
);

/* ---------------- error handling ---------------- */

app.use(errorHandler);
