import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../errors';

type AccessTokenPayload = {
  sub: string; // identity subject
  sid: string; // session identifier
};

export function authenticateAccessToken(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError();
  }

  const token = authHeader.slice('Bearer '.length);

  let payload: AccessTokenPayload;

  try {
    payload = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET!,
      {
        issuer: 'auth-service',
        // audience can be added later
      }
    ) as AccessTokenPayload;
  } catch {
    throw new UnauthorizedError();
  }

  if (!payload.sub || !payload.sid) {
    // Defensive: malformed token
    throw new UnauthorizedError();
  }

  // Inject authenticated context
  (req as any).sessionIdentifier = payload.sid;
  (req as any).identitySubject = payload.sub;

  next();
}
