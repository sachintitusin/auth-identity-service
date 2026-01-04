import 'express';

declare global {
  namespace Express {
    interface Request {
      identitySubject?: string;
      sessionIdentifier?: string;
    }
  }
}