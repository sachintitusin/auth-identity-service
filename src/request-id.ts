import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const incomingId = req.header('x-request-id');

  const requestId = incomingId ?? crypto.randomUUID();

  // attach to request object
  (req as any).requestId = requestId;

  // expose to client
  res.setHeader('X-Request-Id', requestId);

  next();
}
