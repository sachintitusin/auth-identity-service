import express from 'express';
import morgan from 'morgan';
import { pool } from './db';
import { requestIdMiddleware } from './request-id';
import { errorHandler } from './error-handler';

import { register } from './handlers/auth.register';
import { login } from './handlers/auth.login';

import { validateBody } from './middleware/validate';
import { registerSchema } from './schemas/register.schema';
import { logoutCurrentSession } from './handlers/sessions.logout';
import { refreshTokens } from './handlers/tokens.refresh';
import { loginSchema } from './schemas/login.schema';
import cookieParser from 'cookie-parser';
import { authenticateAccessToken } from './middleware/authenticate-access-token';
import { logoutAllSessions } from './handlers/sessions.logout.all';
import { changePassword } from './handlers/auth.password.change';
import { changePasswordSchema } from './schemas/auth.password.change.schema';

import {
  initiateEmailVerificationHandler,
} from './handlers/verifications.email';
import {
  confirmEmailVerificationHandler,
} from './handlers/verifications.email.confirm';



export const app = express();

app.use(cookieParser());
app.use(express.json());
app.use(requestIdMiddleware);

morgan.token('request-id', (req) => (req as any).requestId);

app.use(
  morgan(':method :url :status :response-time ms - reqId=:request-id')
);

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

app.post('/auth/register', validateBody(registerSchema), register);
app.post('/auth/login', validateBody(loginSchema), async (req, res) => {
  const result = await login(req);

  // for mobile clients X-Refresh-Token-Delivery = "body"
  const delivery = req.header('X-Refresh-Token-Delivery');

  // Pattern 1: always set HttpOnly cookie
  res.cookie('refresh_token', result._refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/tokens/refresh',
  });

  // Explicit mobile opt-in. 
  // Mobile  gets refresh token in body
  if (delivery === 'body') {
    return res.status(200).json({
      session: result.session,
      refresh_token: result._refreshToken,
    });
  }

  // Default: browser-safe response
  return res.status(200).json({
    session: result.session,
  });
});

app.post('/tokens/refresh', refreshTokens);
app.delete('/sessions/current', authenticateAccessToken, logoutCurrentSession);
app.delete(
  '/sessions',
  authenticateAccessToken,
  logoutAllSessions
);
app.put(
  '/auth/password',
  validateBody(changePasswordSchema),   // 400 BAD_REQUEST
  authenticateAccessToken,          // 401 UNAUTHORIZED
  changePassword                    // 204 / AUTH_FAILED
);

app.post('/verifications/email', initiateEmailVerificationHandler);
app.post('/verifications/email/confirm', confirmEmailVerificationHandler);


app.use(errorHandler);

